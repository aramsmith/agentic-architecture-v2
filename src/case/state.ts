import type { LoadedRecord } from "./records.js";
import type { LifecycleManifest } from "../types.js";
import { asApproval, latestApprovals, latestCandidateEvents, latestReviews, bindingSet, type Approval } from "./review-records.js";

/** Record-derived state. Callers must also check case validation before authorising work. */
export function phaseEvents(records: LoadedRecord[], phaseId: string, at = Infinity): LoadedRecord[] {
  return records.filter(({ value }) => value.recordType === "run-journal-event" &&
    value.phaseId === phaseId && typeof value.timestamp === "string" && Date.parse(value.timestamp) <= at)
    .sort((a, b) => Number(a.value.sequence) - Number(b.value.sequence));
}

export function decisionAt(records: LoadedRecord[], phaseId: string, at = Infinity): Approval | undefined {
  return latestApprovals(records.map(asApproval).filter((a): a is Approval =>
    a !== undefined && Date.parse(a.decidedAt) <= at)).get(phaseId);
}

export function activeApproval(records: LoadedRecord[], phaseId: string, at = Infinity): Approval | undefined {
  const approval = decisionAt(records, phaseId, at);
  if (!approval || approval.decision !== "APPROVED") return undefined;
  const decided = Date.parse(approval.decidedAt);
  const invalidated = phaseEvents(records, phaseId, at).some(({ value }) =>
    ["PHASE-REOPENED", "BLOCKER", "ARTIFACTS-RECORDED"].includes(String(value.eventType)) &&
    Date.parse(String(value.timestamp)) >= decided);
  if (invalidated) return undefined;
  const visible = records.filter(({ value }) => value.recordType !== "review-record" ||
    (typeof value.reviewedAt === "string" && Date.parse(value.reviewedAt) <= at));
  const reviews = latestReviews(visible);
  // A new review round withdraws the old gate until a new decision cites it.
  for (const reviewer of ["AFF-A", "AFF-B"]) {
    const review = reviews.get(`${phaseId}:${reviewer}`);
    if (!review || !review.final || !approval.reviewRecords.some(({ path }) => path === review.file)) return undefined;
    const reviewedAt = Date.parse(String(visible.find(({ file }) => file === review.file)?.value.reviewedAt));
    if (!Number.isFinite(reviewedAt) || reviewedAt > decided) return undefined;
  }
  return approval;
}

export interface PhaseStatus {
  state: string;
  approval?: Approval;
  recommendation: string;
}

export function phaseStatus(records: LoadedRecord[], phaseId: string, lifecycle?: LifecycleManifest): PhaseStatus {
  const events = phaseEvents(records, phaseId);
  const last = events.at(-1);
  const decision = decisionAt(records, phaseId);
  const active = activeApproval(records, phaseId);
  const history = decision ? { approval: decision } : {};
  if (lifecycle) {
    const index = lifecycle.standardRoute.indexOf(phaseId);
    const ancestors = index > 0 ? lifecycle.standardRoute.slice(0, index) :
      (lifecycle.phases.find(({ id }) => id === phaseId)?.requires ?? [])
        .flatMap((requirement) => /^approved-phase-([0-8])$/u.exec(requirement)?.[1] ?? []);
    const blockedBy = ancestors.find((id) => !activeApproval(records, id));
    if (blockedBy && (decision || events.length)) return { ...history, state: `Blocked by phase ${blockedBy}`,
      recommendation: `Resolve phase ${blockedBy} and record its approval, then review this phase's evidence before resuming.` };
    if (decision && ancestors.some((id) => {
      const upstream = activeApproval(records, id);
      return upstream && Date.parse(upstream.decidedAt) > Date.parse(decision.decidedAt);
    })) return { ...history, state: "Stale approval",
      recommendation: "An upstream phase was reapproved after this decision. Review its impact, refresh this phase's reviews, and record a new decision." };
  }
  if (active) {
    const synthetic = active.syntheticTestEvidence ? "Synthetic test approval" : "Approved";
    return { state: last?.value.eventType === "PHASE-EXITED" ? `${synthetic} and exited` : synthetic,
      approval: active, recommendation: "Review downstream readiness before continuing. Optional execution always needs separate authorisation." };
  }
  const invalidation = [...events].reverse().find(({ value }) =>
    ["PHASE-REOPENED", "BLOCKER"].includes(String(value.eventType)) &&
    (!decision || Date.parse(String(value.timestamp)) >= Date.parse(decision.decidedAt)));
  if (invalidation) return { ...history,
    state: invalidation.value.eventType === "BLOCKER" ? "Blocked" : "Reopened",
    recommendation: "Resolve the recorded issue, obtain fresh final reviews, and record a new human decision." };
  if (decision?.decision === "REJECTED") return { ...history, state: "Rejected",
    recommendation: "Address the rejection and reviewer findings; submit a new candidate for review." };
  if (decision) return { ...history, state: "Stale approval",
    recommendation: "The candidate or review has changed. Complete re-review and record a new decision." };
  const candidate = latestCandidateEvents(records).get(phaseId);
  const reviews = latestReviews(records);
  const a = reviews.get(`${phaseId}:AFF-A`);
  const b = reviews.get(`${phaseId}:AFF-B`);
  if (a?.verdict === "DIVERGES" || b?.verdict === "DIVERGES") return {
    state: "Changes required", recommendation: "Resolve blocking reviewer findings. You may record a rejection; approval requires converged reviews." };
  if (candidate && a?.final && b?.final && bindingSet(a.subjectArtifacts) === bindingSet(b.subjectArtifacts) &&
    bindingSet(candidate.artifacts) === bindingSet(a.subjectArtifacts)) return {
    state: "Awaiting human decision", recommendation: "Validate the case, read the evidence and residual gaps, then run the approval command in your own terminal." };
  if (candidate) return { state: "In review", recommendation: "Complete both final reviews against the full current candidate." };
  if (events.length) return { state: "In progress", recommendation: "Complete the phase artifacts and record the candidate for review." };
  if (phaseId === "7" || phaseId === "8") return { state: "Not invoked",
    recommendation: "Optional execution is not yet available to validated workflows: scoped authorisation and deployment-result contracts remain unimplemented. Do not bypass the prerequisites." };
  return { state: "Not invoked", recommendation: "Complete predecessor gates before starting this phase." };
}
