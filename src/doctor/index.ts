import { stat } from "node:fs/promises";
import path from "node:path";

import { validateFramework } from "../framework/index.js";
import { identityDirectory, privateKeyFileName, readIdentity } from "../identity/keys.js";
import type { ValidationError } from "../types.js";

export interface DoctorCheck {
  id: string;
  status: "verified" | "missing" | "manual";
  message: string;
  errors?: ValidationError[];
}

export interface DoctorReport {
  repositoryRoot: string;
  readiness: "blocked" | "manual-verification-required";
  checks: DoctorCheck[];
}

/** Read-only local diagnostics. Host model and presentation tools require a
 * live host check; installing a package or finding a skill cannot prove them. */
export async function diagnoseSetup(options: {
  repositoryRoot: string;
  home?: string;
  nodeVersion?: string;
}): Promise<DoctorReport> {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const version = options.nodeVersion ?? process.versions.node;
  const major = /^v?(\d+)\./u.exec(version)?.[1];
  const checks: DoctorCheck[] = [{
    id: "node",
    status: major && Number(major) >= 22 ? "verified" : "missing",
    message: major && Number(major) >= 22
      ? `Node ${version} satisfies the Node >=22 requirement.`
      : `Node ${version} does not satisfy the Node >=22 requirement.`,
  }];

  try {
    const result = await validateFramework(repositoryRoot);
    checks.push({
      id: "framework",
      status: result.errors.length === 0 ? "verified" : "missing",
      message: result.errors.length === 0
        ? "Local framework profiles, contracts, schemas, and references validate."
        : `Local framework validation reports ${result.errors.length} failure(s).`,
      ...(result.errors.length > 0 ? { errors: result.errors } : {}),
    });
  } catch (error: unknown) {
    checks.push({ id: "framework", status: "missing", message: `Framework validation could not complete: ${error instanceof Error ? error.message : "unknown error"}` });
  }

  try {
    const identity = await readIdentity(options.home);
    if (!identity) {
      checks.push({ id: "identity", status: "missing", message: "No local architect approval identity was found. Signed human decisions require an identity." });
    } else {
      const key = await stat(path.join(identityDirectory(options.home), privateKeyFileName));
      checks.push({
        id: "identity",
        status: key.isFile() ? "verified" : "missing",
        message: key.isFile()
          ? "Local public identity is readable and the private-key file exists. Its contents and passphrase were not read; signing capability is unverified."
          : "Local public identity exists, but its private-key path is not a file.",
      });
    }
  } catch {
    checks.push({ id: "identity", status: "missing", message: "Local approval identity is incomplete or unreadable. Inspect the public identity and private-key file locally; no private-key contents were read." });
  }

  checks.push(
    { id: "host-models", status: "manual", message: "Live model availability and AFF-A model separation must be verified in the agent host. Lifecycle model names and local dependencies do not prove access." },
    { id: "phase-6-deckio", status: "manual", message: "Phase 6 DECKIO authoring/rendering tools are unverified. Confirm their configuration and successful operation in the presentation host." },
    { id: "phase-6-pdf", status: "manual", message: "Phase 6 full PDF export is unverified. Confirm the host PDF export tool and inspect an exported presentation before relying on it." },
  );
  return {
    repositoryRoot,
    readiness: checks.some(({ status }) => status === "missing") ? "blocked" : "manual-verification-required",
    checks,
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  return [
    `AFF setup: ${report.readiness}`,
    ...report.checks.map((check) => [
      `[${check.status}] ${check.id}: ${check.message}`,
      ...(check.errors ?? []).map(({ file, invariant, message, remediation }) => `  ${file} [${invariant}]: ${message}\n  Fix: ${remediation}`),
    ].join("\n")),
    "Manual checks remain unverified; this report does not certify end-to-end readiness.",
  ].join("\n");
}
