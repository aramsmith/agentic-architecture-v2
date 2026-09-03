import path from "node:path";

import type { ValidationError } from "../types.js";
import type { LoadedRecord } from "./records.js";
import {
  allReviews,
  asApproval,
  bindingSet,
  latestReviews,
  type Approval,
} from "./review-records.js";

export function validateApprovals(records: LoadedRecord[]): ValidationError[] {
  const reviewByFile = new Map(
    allReviews(records).map((review) => [review.file, review]),
  );
  const currentReviews = latestReviews(records);
  const approvals = records
    .map(asApproval)
    .filter((record): record is Approval => record !== undefined);
  const latestApprovals = new Map<string, Approval>();
  const errors: ValidationError[] = [];

  for (const approval of approvals) {
    if (!approval.file.startsWith(`approvals/phase-${approval.phaseId}/`)) {
      errors.push({
        file: approval.file,
        invariant: "record-location",
        message: "Approval directory does not match its phaseId.",
        remediation: `Store it beneath approvals/phase-${approval.phaseId}/.`,
      });
    }
    const current = latestApprovals.get(approval.phaseId);
    if (
      !current ||
      Date.parse(approval.decidedAt) > Date.parse(current.decidedAt)
    ) {
      latestApprovals.set(approval.phaseId, approval);
    } else if (
      Date.parse(approval.decidedAt) === Date.parse(current.decidedAt)
    ) {
      errors.push({
        file: `${current.file}; ${approval.file}`,
        invariant: "approval-binding",
        message: "Two approvals for the same phase have the same decision time.",
        remediation:
          "Keep immutable decisions with distinct RFC 3339 instants so current state is deterministic.",
      });
    }
  }

  for (const approval of approvals) {
    const citedReviews = approval.reviewRecords.flatMap(({ path: reviewPath }) => {
      const review = reviewByFile.get(path.posix.normalize(reviewPath));
      return review ? [review] : [];
    });
    const affA = citedReviews.find(({ reviewer }) => reviewer === "AFF-A");
    const affB = citedReviews.find(({ reviewer }) => reviewer === "AFF-B");
    if (
      citedReviews.length !== 2 ||
      !affA ||
      !affB ||
      !affA.final ||
      !affB.final ||
      affA.phaseId !== approval.phaseId ||
      affB.phaseId !== approval.phaseId
    ) {
      errors.push({
        file: approval.file,
        invariant: "approval-binding",
        message: `Approval for phase ${approval.phaseId} has no complete final reviewer pair.`,
        remediation:
          "Create final AFF-A and AFF-B records before recording the human decision.",
      });
      continue;
    }

    const converged = bindingSet(affA.subjectArtifacts);
    if (
      converged !== bindingSet(affB.subjectArtifacts) ||
      converged !== bindingSet(approval.artifactHashes)
    ) {
      errors.push({
        file: approval.file,
        invariant: "approval-binding",
        message:
          "Human approval is not bound to the identical artifact hash set covered by both final reviews.",
        remediation:
          "Record a new human decision that cites the current converged artifact hashes.",
      });
    }

    const expectedReviewFiles = [affA.file, affB.file].sort();
    const actualReviewFiles = approval.reviewRecords
      .map(({ path: reviewPath }) => path.posix.normalize(reviewPath))
      .sort();
    if (expectedReviewFiles.join("\n") !== actualReviewFiles.join("\n")) {
      errors.push({
        file: approval.file,
        invariant: "approval-binding",
        message:
          "Human approval does not cite one final AFF-A and one final AFF-B record for its phase.",
        remediation:
          "Bind the approval to the latest final review JSON records for this phase.",
      });
    }

    if (
      approval.decision === "APPROVED" &&
      (affA.verdict === "DIVERGES" || affB.verdict === "DIVERGES")
    ) {
      errors.push({
        file: approval.file,
        invariant: "approval-binding",
        message: "An APPROVED decision cannot override a DIVERGES final verdict.",
        remediation:
          "Resolve blockers and complete new converged reviews before approval.",
      });
    }
  }

  for (const approval of latestApprovals.values()) {
    if (approval.decision !== "APPROVED") {
      continue;
    }
    const affA = currentReviews.get(`${approval.phaseId}:AFF-A`);
    const affB = currentReviews.get(`${approval.phaseId}:AFF-B`);
    const cited = approval.reviewRecords
      .map(({ path: reviewPath }) => path.posix.normalize(reviewPath))
      .sort()
      .join("\n");
    const current =
      affA && affB ? [affA.file, affB.file].sort().join("\n") : "";
    if (!affA?.final || !affB?.final || cited !== current) {
      errors.push({
        file: approval.file,
        invariant: "approval-binding",
        message:
          "The latest approval is stale because a newer or incomplete review round exists.",
        remediation:
          "Complete the current final reviews and record a new human decision.",
      });
    }
  }

  return errors;
}
