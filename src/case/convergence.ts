import type { ValidationError } from "../types.js";
import type { LoadedRecord } from "./records.js";
import {
  allReviews,
  bindingSet,
  latestCandidateEvents,
  latestReviews,
  phaseArtifactNames,
  phaseFolders,
  type Review,
} from "./review-records.js";

export function validateReviewConvergence(
  records: LoadedRecord[],
): ValidationError[] {
  const reviews = allReviews(records);
  const latest = latestReviews(records);
  const candidates = latestCandidateEvents(records);
  const phases = new Set(
    [...latest.values()].map(({ phaseId }) => phaseId),
  );
  const errors: ValidationError[] = [];

  const reviewIdentities = new Map<string, Review[]>();
  for (const review of reviews) {
    const key = `${review.phaseId}:${review.reviewer}:${review.round}`;
    const matches = reviewIdentities.get(key) ?? [];
    matches.push(review);
    reviewIdentities.set(key, matches);
  }
  for (const matches of reviewIdentities.values()) {
    if (matches.length > 1) {
      errors.push({
        file: matches.map(({ file }) => file).join("; "),
        invariant: "review-convergence",
        message:
          "More than one review record declares the same reviewer, phase, and round.",
        remediation:
          "Keep one immutable record per reviewer/phase/round and use the next round number for re-review.",
      });
    }
  }

  for (const phaseId of phases) {
    const affA = latest.get(`${phaseId}:AFF-A`);
    const affB = latest.get(`${phaseId}:AFF-B`);
    if (!affA || !affB || !affA.final || !affB.final) {
      errors.push({
        file: affA?.file ?? affB?.file ?? "reviews",
        invariant: "review-convergence",
        message: `Phase ${phaseId} does not have final records from both AFF-A and AFF-B.`,
        remediation:
          "Complete both independent final reviews against the full unchanged artifact set.",
      });
      continue;
    }
    const affASet = bindingSet(affA.subjectArtifacts);
    const affBSet = bindingSet(affB.subjectArtifacts);
    const reopenedAt = Math.max(-Infinity, ...records.filter(({ value }) =>
      value.recordType === "run-journal-event" && value.phaseId === phaseId &&
      ["PHASE-REOPENED", "BLOCKER"].includes(String(value.eventType)))
      .map(({ value }) => Date.parse(String(value.timestamp))));
    for (const review of [affA, affB]) {
      const source = records.find(({ file }) => file === review.file);
      if (source && Date.parse(String(source.value.reviewedAt)) <= reopenedAt) {
        errors.push({ file: review.file, invariant: "review-convergence",
          message: `Phase ${phaseId} final review predates its latest reopening or blocker.`,
          remediation: "Complete a new final review round after resolving the issue before recording a new decision." });
      }
    }
    if (affASet !== affBSet) {
      errors.push({
        file: `${affA.file}; ${affB.file}`,
        invariant: "review-convergence",
        message: `Phase ${phaseId} final reviewers cover different artifact paths or hashes.`,
        remediation:
          "Re-run both final reviews against the identical current artifact set.",
      });
    }

    const candidate = candidates.get(phaseId);
    if (!candidate) {
      errors.push({
        file: `${affA.file}; ${affB.file}`,
        invariant: "review-convergence",
        message: `Phase ${phaseId} has no current ARTIFACTS-RECORDED journal event.`,
        remediation:
          "Append the complete candidate hash set to the run journal before final review.",
      });
      continue;
    }
    if (affASet !== bindingSet(candidate.artifacts)) {
      errors.push({
        file: `${candidate.file}; ${affA.file}; ${affB.file}`,
        invariant: "review-convergence",
        message: `Phase ${phaseId} final reviews do not cover the complete current journalled candidate.`,
        remediation:
          "Review every artifact in the latest ARTIFACTS-RECORDED hash set.",
      });
    }

    const candidatePaths = new Set(
      candidate.artifacts.map(({ path }) => path),
    );
    const phaseFolder = phaseFolders[phaseId];
    const requiredNames = phaseArtifactNames[phaseId] ?? [];
    const missing = requiredNames
      .map((name) => `${phaseFolder}/${candidate.artifactPrefix}-${name}`)
      .filter((requiredPath) => !candidatePaths.has(requiredPath));
    if (missing.length > 0) {
      errors.push({
        file: candidate.file,
        invariant: "review-convergence",
        message: `Phase ${phaseId} candidate omits contracted artifact(s): ${missing.join(", ")}.`,
        remediation:
          "Record the complete phase Markdown, HTML, and structured catalogue set before review.",
      });
    }
  }

  return errors;
}
