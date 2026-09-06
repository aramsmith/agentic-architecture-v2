import type {
  LifecycleManifest,
  LifecyclePhase,
  ValidationError,
} from "../types.js";
import type { LoadedRecord } from "./records.js";
import { activeApproval } from "./state.js";
import {
  asApproval,
  firstPhaseEntries,
  latestApprovals,
  latestCandidateEvents,
  type Approval,
} from "./review-records.js";

const invariant = "phase-sequence";
const approvedPhasePattern = /^approved-phase-([0-8])$/u;

interface Prerequisite {
  phaseId: string;
  reason: string;
}

interface PhasePrerequisites {
  approvals: Prerequisite[];
  unverifiable: string[];
}

function prerequisitesFor(
  lifecycle: LifecycleManifest,
  phase: LifecyclePhase,
): PhasePrerequisites {
  const approvals = new Map<string, Prerequisite>();
  const unverifiable: string[] = [];
  const routeIndex = lifecycle.standardRoute.indexOf(phase.id);
  const routePredecessor =
    routeIndex > 0 ? lifecycle.standardRoute[routeIndex - 1] : undefined;

  if (routePredecessor) {
    approvals.set(routePredecessor, {
      phaseId: routePredecessor,
      reason: "the standard route order",
    });
  }

  for (const requirement of phase.requires ?? []) {
    const match = approvedPhasePattern.exec(requirement);
    if (match?.[1]) {
      approvals.set(match[1], {
        phaseId: match[1],
        reason: `the declared prerequisite "${requirement}"`,
      });
      continue;
    }
    unverifiable.push(requirement);
  }

  return { approvals: [...approvals.values()], unverifiable };
}

export function validatePhaseSequence(
  records: LoadedRecord[],
  lifecycle: LifecycleManifest,
): ValidationError[] {
  const approvals = latestApprovals(
    records
      .map(asApproval)
      .filter((approval): approval is Approval => approval !== undefined),
  );
  const candidates = latestCandidateEvents(records);
  const entries = firstPhaseEntries(records);
  const errors: ValidationError[] = [];

  for (const phase of lifecycle.phases) {
    const approval = approvals.get(phase.id);
    const evidence =
      approval ?? candidates.get(phase.id) ?? entries.get(phase.id);
    if (!evidence) {
      continue;
    }

    const activity = approval
      ? "was approved"
      : candidates.get(phase.id)
        ? "recorded candidate artifacts"
        : "was entered";
    const { approvals: required, unverifiable } = prerequisitesFor(
      lifecycle,
      phase,
    );

    for (const prerequisite of required) {
      const predecessor = approvals.get(prerequisite.phaseId);
      if (!predecessor || predecessor.decision !== "APPROVED") {
        errors.push({
          file: evidence.file,
          invariant,
          message: `Phase ${phase.id} ${activity} while phase ${prerequisite.phaseId} has no approved human decision, required by ${prerequisite.reason}.`,
          remediation: `Complete phase ${prerequisite.phaseId} and record its human approval before entering or approving phase ${phase.id}.`,
        });
        continue;
      }

      if (
        approval &&
        Date.parse(approval.decidedAt) < Date.parse(predecessor.decidedAt)
      ) {
        errors.push({
          file: `${predecessor.file}; ${approval.file}`,
          invariant,
          message: `Phase ${phase.id} was approved at ${approval.decidedAt}, before phase ${prerequisite.phaseId} was approved at ${predecessor.decidedAt}.`,
          remediation:
            "Record human decisions in lifecycle order using accurate RFC 3339 instants.",
        });
      }

      if (predecessor.decision === "APPROVED" && !activeApproval(records, prerequisite.phaseId)) {
        errors.push({
          file: evidence.file,
          invariant,
          message: `Phase ${phase.id} depends on phase ${prerequisite.phaseId}, whose approval is no longer active.`,
          remediation: `Resolve the reopening, blocker, or changed review in phase ${prerequisite.phaseId} and record a new decision before continuing.`,
        });
      }

      // Validate history at the time work happened, not against a later approval.
      for (const event of records.filter(({ value }) =>
        value.recordType === "run-journal-event" && value.phaseId === phase.id &&
        ["PHASE-ENTERED", "ARTIFACTS-RECORDED"].includes(String(value.eventType)))) {
        const timestamp = String(event.value.timestamp);
        if (!activeApproval(records, prerequisite.phaseId, Date.parse(timestamp))) {
          errors.push({
            file: event.file,
            invariant,
            message: `Phase ${phase.id} activity at ${timestamp} occurred before an active approval of phase ${prerequisite.phaseId}.`,
            remediation: "Preserve the historical violation and record a reviewed recovery before resuming; never backdate approval evidence.",
          });
        }
      }
    }

    for (const requirement of unverifiable) {
      errors.push({
        file: evidence.file,
        invariant,
        message: `Phase ${phase.id} ${activity} but its declared prerequisite "${requirement}" has no catalogued case record, so it cannot be verified.`,
        remediation: `Record "${requirement}" as a catalogued case record before entering phase ${phase.id}, or remove the requirement from .github/agents/AFF-LIFECYCLE.json when it is not evidence-bound.`,
      });
    }
  }

  return errors;
}
