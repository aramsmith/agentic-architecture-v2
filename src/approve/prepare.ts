import { randomUUID } from "node:crypto";
import { lstat, mkdir, open } from "node:fs/promises";
import path from "node:path";

import { validateLoadedCase } from "../case/index.js";
import { activeApproval } from "../case/state.js";
import { resolveCasePath } from "../case/path.js";
import { loadCaseRecords } from "../case/records.js";
import {
  asApproval,
  latestApprovals,
  latestCandidateEvents,
  latestReviews,
  type Binding,
  type Approval,
} from "../case/review-records.js";
import { readLifecycle } from "../framework/lifecycle.js";
import {
  IdentityError,
  readEncryptedPrivateKey,
  readIdentity,
} from "../identity/keys.js";
import { signApproval } from "../identity/signature.js";

export interface ApprovalContext {
  repositoryRoot: string;
  casePath: string;
  caseRoot: string;
  caseName: string;
  artifactPrefix: string;
  phaseId: string;
  artifacts: Binding[];
  reviewBindings: Binding[];
  verdicts: { reviewer: string; verdict: string; round: number }[];
  outputPath: string;
  approverLabel: string;
  keyFingerprint: string;
}

export class ApproveError extends Error {
  public constructor(
    message: string,
    public readonly remediation: string,
  ) {
    super(`${message} Fix: ${remediation}`);
    this.name = "ApproveError";
  }
}

function bindingKey(bindings: Binding[]): string {
  return bindings
    .map(({ path: bindingPath, sha256 }) => `${bindingPath}=${sha256}`)
    .sort()
    .join("\n");
}

function byPath(left: Binding, right: Binding): number {
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
}

/**
 * The phases that must already hold an approved decision before this one may be
 * approved: the preceding standard-route phase, plus any explicit
 * `approved-phase-<id>` prerequisite the lifecycle declares.
 */
async function requiredApprovedPhases(
  repositoryRoot: string,
  phaseId: string,
): Promise<string[]> {
  const lifecycle = await readLifecycle(repositoryRoot);
  const required = new Set<string>();
  const routeIndex = lifecycle.standardRoute.indexOf(phaseId);
  const routePredecessor =
    routeIndex > 0 ? lifecycle.standardRoute[routeIndex - 1] : undefined;
  if (routePredecessor) {
    required.add(routePredecessor);
  }
  const phase = lifecycle.phases.find(({ id }) => id === phaseId);
  for (const requirement of phase?.requires ?? []) {
    const match = /^approved-phase-([0-8])$/u.exec(requirement);
    if (match?.[1]) {
      required.add(match[1]);
    }
  }
  return [...required];
}

/**
 * Gathers everything the architect must see before deciding, and fails closed
 * when the phase is not actually ready. The command refuses to offer a decision
 * the evidence does not support, so approval cannot become a reflex.
 */
export async function prepareApproval(options: {
  repositoryRoot: string;
  casePath: string;
  phaseId: string;
  home?: string;
}): Promise<ApprovalContext> {
  const identity = await readIdentity(options.home);
  if (!identity) {
    throw new ApproveError(
      "No architect approval identity exists on this machine.",
      "Create the architect identity once before approving a phase.",
    );
  }

  const resolved = await resolveCasePath(
    options.repositoryRoot,
    options.casePath,
  );
  if (!resolved.caseRoot) {
    throw new ApproveError(
      resolved.errors[0]?.message ?? "The case path is invalid.",
      resolved.errors[0]?.remediation ?? "Pass cases/<case-name>.",
    );
  }
  const caseRoot = resolved.caseRoot;

  const loaded = await loadCaseRecords(options.repositoryRoot, caseRoot);
  const validation = await validateLoadedCase(
    options.repositoryRoot,
    caseRoot,
    loaded,
    { ...(options.home ? { home: options.home } : {}) },
  );
  // A replacement decision can settle only its own stale-current-review error.
  // Invalid historical signatures, review bindings, and predecessor state remain
  // blocking even when they concern the phase receiving the new decision.
  const targetApprovals = new Set(loaded.records.filter(({ value }) =>
    value.recordType === "human-approval" && value.phaseId === options.phaseId,
  ).map(({ file }) => file));
  const previous = latestApprovals(loaded.records.map(asApproval)
    .filter((approval): approval is Approval => approval !== undefined)).get(options.phaseId);
  const replacedArtifactErrors = new Set((previous?.artifactHashes ?? []).map(({ path: artifactPath }) =>
    `Artifact "${artifactPath}" has SHA-256 `));
  const blocking = [
    ...new Set(
      validation.errors
        .filter((error) => !((error.invariant === "approval-binding" &&
          targetApprovals.has(error.file) &&
          error.message === "The latest approval is stale because a newer or incomplete review round exists.") ||
          (error.invariant === "artifact-hash-binding" && error.file === previous?.file &&
            [...replacedArtifactErrors].some((prefix) => error.message.startsWith(prefix)) &&
            !previous.reviewRecords.some(({ path: reviewPath }) => error.message.startsWith(`Artifact "${reviewPath}" `))) ||
          (error.invariant === "phase-sequence" &&
            error.message.endsWith(`depends on phase ${options.phaseId}, whose approval is no longer active.`)) ||
          (error.invariant === "phase-sequence" && previous &&
            error.file.split("; ").includes(previous.file) &&
            error.message.startsWith(`Phase ${options.phaseId} was approved at ${previous.decidedAt}, before phase `))))
        .map(({ invariant }) => invariant),
    ),
  ];
  if (blocking.length > 0) {
    throw new ApproveError(
      `The case does not currently validate: ${blocking.join(", ")}.`,
      "Resolve the reported contract failures before recording a human decision.",
    );
  }

  for (const required of await requiredApprovedPhases(
    options.repositoryRoot,
    options.phaseId,
  )) {
    if (!activeApproval(loaded.records, required)) {
      throw new ApproveError(
        `Phase ${options.phaseId} cannot be approved while phase ${required} has no approved human decision.`,
        `Approve phase ${required} first. Phases are approved in lifecycle order.`,
      );
    }
  }

  const reviews = latestReviews(loaded.records);
  const affA = reviews.get(`${options.phaseId}:AFF-A`);
  const affB = reviews.get(`${options.phaseId}:AFF-B`);
  if (!affA?.final || !affB?.final) {
    throw new ApproveError(
      `Phase ${options.phaseId} has no final record from both AFF-A and AFF-B.`,
      "Complete both independent final reviews before approving.",
    );
  }
  if (bindingKey(affA.subjectArtifacts) !== bindingKey(affB.subjectArtifacts)) {
    throw new ApproveError(
      `The Phase ${options.phaseId} reviewers cover different artifacts or hashes.`,
      "Re-run both final reviews against the identical current artifact set.",
    );
  }

  const candidate = latestCandidateEvents(loaded.records).get(options.phaseId);
  if (!candidate) {
    throw new ApproveError(
      `Phase ${options.phaseId} has no current ARTIFACTS-RECORDED journal event.`,
      "Append the complete candidate hash set to the run journal before approval.",
    );
  }
  if (bindingKey(candidate.artifacts) !== bindingKey(affA.subjectArtifacts)) {
    throw new ApproveError(
      `The Phase ${options.phaseId} reviews do not cover the complete journalled candidate.`,
      "Review every artifact in the latest ARTIFACTS-RECORDED hash set.",
    );
  }

  const snapshots = new Map(
    loaded.records.map((record) => [record.file, record.snapshotSha256]),
  );
  const reviewBindings: Binding[] = [];
  for (const review of [affA, affB]) {
    const sha256 = snapshots.get(review.file);
    if (!sha256) {
      throw new ApproveError(
        `The review record ${review.file} could not be hashed.`,
        "Ensure both final review records are present and valid before approving.",
      );
    }
    reviewBindings.push({ path: review.file, sha256 });
  }

  return {
    repositoryRoot: options.repositoryRoot,
    casePath: options.casePath,
    caseRoot,
    caseName: path.basename(caseRoot),
    artifactPrefix: candidate.artifactPrefix,
    phaseId: options.phaseId,
    artifacts: [...affA.subjectArtifacts].sort(byPath),
    reviewBindings: reviewBindings.sort(byPath),
    verdicts: [affA, affB].map(({ reviewer, verdict, round }) => ({
      reviewer,
      verdict,
      round,
    })),
    outputPath: `approvals/phase-${options.phaseId}/${candidate.artifactPrefix}-phase-${options.phaseId}-approval-${randomUUID()}.json`,
    approverLabel: identity.label,
    keyFingerprint: identity.fingerprint,
  };
}

export async function recordSignedDecision(options: {
  context: ApprovalContext;
  decision: "APPROVED" | "REJECTED";
  passphrase: string;
  decidedAt?: string;
  residualGapAcceptance?: string[];
  keyRotation?: { previousKeyFingerprint: string; reason: string };
  home?: string;
}): Promise<{ file: string; keyFingerprint: string }> {
  const { context } = options;
  if (options.decision === "APPROVED" && context.verdicts.some(({ verdict }) => verdict === "DIVERGES")) {
    throw new ApproveError("An APPROVED decision cannot override a DIVERGES final verdict.",
      "Resolve the blockers and complete new reviews, or record a rejection.");
  }
  if (!/^approvals\/phase-[0-8]\/[a-z0-9-]+\.json$/u.test(context.outputPath) ||
      !context.outputPath.startsWith(`approvals/phase-${context.phaseId}/`)) {
    throw new ApproveError("Invalid approval output path.", "Prepare the decision again using the approval command.");
  }
  if (!context.repositoryRoot || !context.casePath) {
    throw new ApproveError("A complete case context is required before signing.",
      "Prepare the decision again using the approval command.");
  }
  {
    const fresh = await prepareApproval({
      repositoryRoot: context.repositoryRoot,
      casePath: context.casePath,
      phaseId: context.phaseId,
      ...(options.home ? { home: options.home } : {}),
    });
    if (fresh.caseRoot !== context.caseRoot || fresh.caseName !== context.caseName ||
      fresh.artifactPrefix !== context.artifactPrefix ||
      JSON.stringify(fresh.verdicts) !== JSON.stringify(context.verdicts) ||
      bindingKey(fresh.artifacts) !== bindingKey(context.artifacts) ||
      bindingKey(fresh.reviewBindings) !== bindingKey(context.reviewBindings) ||
      fresh.keyFingerprint !== context.keyFingerprint ||
      fresh.approverLabel !== context.approverLabel) {
      throw new ApproveError("The approval evidence or identity changed while the decision was being entered.",
        "Restart the approval command and review the current evidence.");
    }
  }
  const identity = await readIdentity(options.home);
  if (!identity) {
    throw new ApproveError(
      "No architect approval identity exists on this machine.",
      "Create the architect identity once before approving a phase.",
    );
  }
  const encryptedPrivateKey = await readEncryptedPrivateKey(options.home);

  const record: Record<string, unknown> = {
    schemaVersion: "1.0.0",
    recordType: "human-approval",
    caseName: context.caseName,
    artifactPrefix: context.artifactPrefix,
    phaseId: context.phaseId,
    artifactHashes: context.artifacts,
    reviewRecords: context.reviewBindings,
    decision: options.decision,
    approver: identity.label,
    decidedAt: options.decidedAt ?? new Date().toISOString(),
    residualGapAcceptance: options.residualGapAcceptance ?? [],
    ...(options.keyRotation
      ? { extensions: { keyRotation: options.keyRotation } }
      : {}),
  };

  let signed: Record<string, unknown>;
  try {
    signed = signApproval(
      record,
      encryptedPrivateKey,
      options.passphrase,
      identity.publicKeyPem,
    );
  } catch (error: unknown) {
    if (error instanceof IdentityError) {
      throw new ApproveError(
        error.message.replace(/ Fix:.*$/su, ""),
        error.remediation,
      );
    }
    throw error;
  }

  const absolute = path.join(context.caseRoot, ...context.outputPath.split("/"));
  const loaded = await loadCaseRecords(context.repositoryRoot, context.caseRoot);
  const prospective = await validateLoadedCase(context.repositoryRoot, context.caseRoot, {
    ...loaded,
    records: [...loaded.records, { file: context.outputPath, absolutePath: absolute,
      value: signed, snapshotSha256: "" }],
  }, { ...(options.home ? { home: options.home } : {}) });
  // Reapproving an upstream phase deliberately makes older downstream decisions
  // stale. Preserve that diagnostic, but allow the architect to repair in order.
  const decisionErrors = prospective.errors.filter((error) => !(error.invariant === "phase-sequence" &&
    error.message.endsWith(`before phase ${context.phaseId} was approved at ${String(signed.decidedAt)}.`) &&
    !error.message.startsWith(`Phase ${context.phaseId} was approved at `)));
  if (decisionErrors.length) {
    throw new ApproveError(`The proposed decision does not validate: ${decisionErrors.map(({ message }) => message).join(" ")}`,
      "Resolve the evidence or decision chronology before signing a new decision.");
  }
  // Only create the two contracted directories and never follow directory links.
  for (const directory of [path.join(context.caseRoot, "approvals"), path.dirname(absolute)]) {
    try { await mkdir(directory); } catch (error: unknown) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    }
    const details = await lstat(directory);
    if (details.isSymbolicLink() || !details.isDirectory()) {
      throw new ApproveError("Approval output directory is not a physical case directory.",
        "Remove the link or conflicting path before recording a decision.");
    }
  }
  const handle = await open(absolute, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(signed, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  return { file: context.outputPath, keyFingerprint: identity.fingerprint };
}
