import { createHash } from "node:crypto";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { canonicalize } from "json-canonicalize";

import { isRecord } from "../common/json.js";
import type { ValidationError } from "../types.js";
import type { LoadedRecord } from "./records.js";

const textExtensions = new Set([
  ".bicep",
  ".bicepparam",
  ".c",
  ".cpp",
  ".cs",
  ".css",
  ".csv",
  ".drawio",
  ".html",
  ".js",
  ".java",
  ".go",
  ".gradle",
  ".ini",
  ".jsonc",
  ".md",
  ".mjs",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".svg",
  ".tf",
  ".tfvars",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

interface ArtifactBinding {
  path: string;
  sha256: string;
}

interface BindingSource {
  file: string;
  value: unknown;
}

function findBindings(value: unknown): ArtifactBinding[] {
  if (Array.isArray(value)) {
    return value.flatMap(findBindings);
  }
  if (!isRecord(value)) {
    return [];
  }

  const ownBinding =
    typeof value.path === "string" && typeof value.sha256 === "string"
      ? [{ path: value.path, sha256: value.sha256 }]
      : [];
  return [
    ...ownBinding,
    ...Object.values(value).flatMap((child) => findBindings(child)),
  ];
}

function canonicalJson(content: string): Buffer {
  const parsed: unknown = JSON.parse(content);
  return Buffer.from(canonicalize(parsed), "utf8");
}

function decodeUtf8(content: Buffer): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(content);
}

function canonicalJsonLines(content: string): Buffer {
  const lines = content
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const parsed: unknown = JSON.parse(line);
      return canonicalize(parsed);
    });
  return Buffer.from(lines.length === 0 ? "" : `${lines.join("\n")}\n`, "utf8");
}

function canonicalText(content: Buffer): Buffer {
  const decoded = decodeUtf8(content);
  const withoutBom = decoded.startsWith("\uFEFF") ? decoded.slice(1) : decoded;
  return Buffer.from(withoutBom.replace(/\r\n?/gu, "\n"), "utf8");
}

export async function hashArtifact(absolutePath: string): Promise<string> {
  const content = await readFile(absolutePath);
  const extension = path.extname(absolutePath).toLowerCase();
  let canonical: Uint8Array = content;

  if (extension === ".json") {
    canonical = canonicalJson(decodeUtf8(content));
  } else if (extension === ".jsonl") {
    canonical = canonicalJsonLines(decodeUtf8(content));
  } else if (textExtensions.has(extension)) {
    canonical = canonicalText(content);
  } else {
    try {
      const decoded = decodeUtf8(content);
      if (!decoded.includes("\0")) {
        canonical = canonicalText(content);
      }
    } catch (error: unknown) {
      if (!(error instanceof TypeError)) {
        throw error;
      }
      canonical = content;
    }
  }

  return createHash("sha256").update(canonical).digest("hex");
}

function isContained(caseRoot: string, candidate: string): boolean {
  const relative = path.relative(caseRoot, candidate);
  return (
    relative !== "" &&
    !path.isAbsolute(relative) &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`)
  );
}

function currentBindingSources(records: LoadedRecord[]): BindingSource[] {
  const sources: BindingSource[] = [];
  const latestReviews = new Map<string, LoadedRecord>();
  const latestApprovals = new Map<string, LoadedRecord>();
  const latestArtifactEvents = new Map<string, LoadedRecord>();

  for (const record of records) {
    const recordType = record.value.recordType;
    if (recordType === "review-record") {
      const phaseId = record.value.phaseId;
      const reviewer = record.value.reviewer;
      const round = record.value.round;
      if (
        typeof phaseId === "string" &&
        typeof reviewer === "string" &&
        typeof round === "number"
      ) {
        const key = `${phaseId}:${reviewer}`;
        const current = latestReviews.get(key);
        if (
          !current ||
          typeof current.value.round !== "number" ||
          round > current.value.round
        ) {
          latestReviews.set(key, record);
        }
      }
      continue;
    }

    if (recordType === "human-approval") {
      sources.push({
        file: record.file,
        value: { reviewRecords: record.value.reviewRecords },
      });
      const phaseId = record.value.phaseId;
      const decidedAt = record.value.decidedAt;
      if (typeof phaseId === "string" && typeof decidedAt === "string") {
        const current = latestApprovals.get(phaseId);
        if (
          !current ||
          typeof current.value.decidedAt !== "string" ||
          Date.parse(decidedAt) > Date.parse(current.value.decidedAt)
        ) {
          latestApprovals.set(phaseId, record);
        }
      }
      continue;
    }

    if (recordType === "run-journal-event") {
      if (record.value.eventType === "ARTIFACTS-RECORDED") {
        const phaseId = record.value.phaseId;
        const sequence = record.value.sequence;
        if (typeof phaseId === "string" && typeof sequence === "number") {
          const current = latestArtifactEvents.get(phaseId);
          if (
            !current ||
            typeof current.value.sequence !== "number" ||
            sequence > current.value.sequence
          ) {
            latestArtifactEvents.set(phaseId, record);
          }
        }
      }
      continue;
    }

    sources.push(record);
  }

  sources.push(...latestReviews.values());
  for (const approval of latestApprovals.values()) {
    sources.push({
      file: approval.file,
      value: { artifactHashes: approval.value.artifactHashes },
    });
  }
  sources.push(...latestArtifactEvents.values());
  return sources;
}

export async function validateHashBindings(
  caseRoot: string,
  records: LoadedRecord[],
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const physicalCaseRoot = await realpath(caseRoot);

  for (const record of currentBindingSources(records)) {
    for (const binding of findBindings(record.value)) {
      const candidate = path.resolve(caseRoot, binding.path);
      if (!isContained(caseRoot, candidate)) {
        errors.push({
          file: record.file,
          invariant: "artifact-hash-binding",
          message: `Artifact path "${binding.path}" escapes the case directory.`,
          remediation: "Use a case-relative path without parent traversal.",
        });
        continue;
      }

      try {
        if ((await lstat(candidate)).isSymbolicLink()) {
          throw new TypeError("symbolic links are not allowed");
        }
        if (!(await stat(candidate)).isFile()) {
          throw new TypeError("not a file");
        }
        const physicalCandidate = await realpath(candidate);
        if (!isContained(physicalCaseRoot, physicalCandidate)) {
          errors.push({
            file: record.file,
            invariant: "artifact-hash-binding",
            message: `Artifact "${binding.path}" resolves outside the case directory.`,
            remediation:
              "Remove the link or junction and bind a physical case artifact.",
          });
          continue;
        }
      } catch (error: unknown) {
        if (
          error instanceof TypeError ||
          (error instanceof Error && "code" in error && error.code === "ENOENT")
        ) {
          errors.push({
            file: record.file,
            invariant: "artifact-hash-binding",
            message: `Bound artifact "${binding.path}" does not exist as a file.`,
            remediation:
              "Restore the artifact or update the record through a new append-only review round.",
          });
          continue;
        }
        throw error;
      }

      let actual: string;
      try {
        actual = await hashArtifact(candidate);
      } catch (error: unknown) {
        if (!(error instanceof SyntaxError) && !(error instanceof TypeError)) {
          throw error;
        }
        errors.push({
          file: record.file,
          invariant: "artifact-hash-binding",
          message: `Artifact "${binding.path}" cannot be canonicalized: ${error.message}`,
          remediation:
            "Correct the artifact encoding or JSON syntax before recording a canonical hash.",
        });
        continue;
      }
      if (actual !== binding.sha256) {
        errors.push({
          file: record.file,
          invariant: "artifact-hash-binding",
          message: `Artifact "${binding.path}" has SHA-256 ${actual}, not recorded ${binding.sha256}.`,
          remediation:
            "Do not edit reviewed evidence in place; create a new review round and approval for the current canonical hash.",
        });
      }
    }
  }

  return errors;
}
