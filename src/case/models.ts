import { isRecord } from "../common/json.js";
import { verifyApprovalSignature } from "../identity/signature.js";
import type { LifecycleManifest, ValidationError } from "../types.js";
import type { LoadedRecord } from "./records.js";
import { asReview, type Review } from "./review-records.js";

interface ModelAssignment {
  agent: string;
  model: string;
  separationStatus: string;
  available: boolean;
  approvalReference?: string;
}

function isModelAssignment(value: unknown): value is ModelAssignment {
  return (
    isRecord(value) &&
    typeof value.agent === "string" &&
    typeof value.model === "string" &&
    typeof value.separationStatus === "string" &&
    typeof value.available === "boolean" &&
    (value.approvalReference === undefined ||
      typeof value.approvalReference === "string")
  );
}

function hasSubstitutionApproval(
  plan: LoadedRecord,
  assignment: ModelAssignment,
  defaultModel: string,
  records: LoadedRecord[],
): boolean {
  const reference = assignment.approvalReference;
  if (!reference || reference.startsWith("/") || reference.includes("\\") || reference.split("/").some((part) => part === "." || part === ".." || part === "")) return false;
  const approval = records.find(({ file, value }) => file === reference && value.recordType === "human-approval");
  if (!approval || approval.value.decision !== "APPROVED" || !verifyApprovalSignature(approval.value).verified) return false;
  const bindings = isRecord(plan.value.extensions) ? plan.value.extensions.modelSubstitutionApprovals : undefined;
  if (!Array.isArray(bindings) || !bindings.some((binding) => isRecord(binding) && binding.path === reference && binding.sha256 === approval.snapshotSha256)) return false;
  // A prior decision authorizes the change; binding the new plan back into
  // that same decision would require a circular pair of content hashes.
  if (Array.isArray(approval.value.artifactHashes) && approval.value.artifactHashes.some((binding) => isRecord(binding) && binding.path === plan.file && binding.sha256 === plan.snapshotSha256)) return false;
  const substitutions = isRecord(approval.value.extensions) ? approval.value.extensions.modelSubstitutions : undefined;
  return Array.isArray(substitutions) && substitutions.some((substitution) =>
    isRecord(substitution) && substitution.agent === assignment.agent &&
    substitution.fromModel === defaultModel && substitution.toModel === assignment.model,
  );
}

export function validateModelPlans(
  records: LoadedRecord[],
  lifecycle: LifecycleManifest,
): ValidationError[] {
  const expected = new Map(
    [...lifecycle.phases, ...lifecycle.reviewers].map(({ owner, model }) => [
      owner,
      model,
    ]),
  );
  const phaseOwners = new Set(lifecycle.phases.map(({ owner }) => owner));
  const errors: ValidationError[] = [];
  const modelPlans = records.filter(
    ({ value }) => value.recordType === "model-plan",
  );
  if (modelPlans.length > 1) {
    errors.push({
      file: modelPlans.map(({ file }) => file).join("; "),
      invariant: "model-plan-consistency",
      message: "The case contains more than one active model-plan record.",
      remediation:
        "Keep one append-updated model plan at the contracted Phase 0 path.",
    });
  }

  for (const record of modelPlans) {
    const assignments = record.value.assignments;
    if (!Array.isArray(assignments) || !assignments.every(isModelAssignment)) {
      continue;
    }
    const byAgent = new Map<string, ModelAssignment>();
    for (const assignment of assignments) {
      if (!assignment.available || !expected.has(assignment.agent)) {
        errors.push({
          file: record.file,
          invariant: "model-plan-consistency",
          message: !assignment.available
            ? `Model "${assignment.model}" assigned to ${assignment.agent} is unavailable.`
            : `Model plan names unknown lifecycle agent "${assignment.agent}".`,
          remediation: "Assign an available model to each declared lifecycle agent; obtain bound human approval for substitutions.",
        });
      }
      if (byAgent.has(assignment.agent)) {
        errors.push({
          file: record.file,
          invariant: "model-plan-consistency",
          message: `Model plan repeats agent "${assignment.agent}".`,
          remediation: "Record exactly one active assignment per AFF agent.",
        });
      }
      byAgent.set(assignment.agent, assignment);
    }

    for (const [agent, defaultModel] of expected) {
      const assignment = byAgent.get(agent);
      if (!assignment) {
        errors.push({
          file: record.file,
          invariant: "model-plan-consistency",
          message: `Model plan omits lifecycle agent "${agent}".`,
          remediation: "Add every phase owner and both declared reviewers.",
        });
        continue;
      }
      if (assignment.model !== defaultModel && !hasSubstitutionApproval(record, assignment, defaultModel, records)) {
        errors.push({
          file: record.file,
          invariant: "model-plan-consistency",
          message: `${agent} changes the default model without verified, hash-bound human approval evidence for this substitution.`,
          remediation:
            "Restore the lifecycle model, or reference a prior signed APPROVED decision with the exact agent/fromModel/toModel in extensions.modelSubstitutions and bind its hash in model-plan extensions.modelSubstitutionApprovals.",
        });
      }
    }

    const affA = byAgent.get("AFF-A-rubber-duck");
    const ownerModels = new Set(
      [...byAgent.values()]
        .filter(({ agent }) => phaseOwners.has(agent))
        .map(({ model }) => model),
    );
    if (
      !affA ||
      ownerModels.has(affA.model) ||
      affA.separationStatus !== "SATISFIED"
    ) {
      errors.push({
        file: record.file,
        invariant: "reviewer-model-separation",
        message:
          "The case model plan does not keep AFF-A on a different model from every phase owner.",
        remediation:
          "Assign AFF-A a different available GPT model and record separationStatus SATISFIED.",
      });
    }
  }

  return errors;
}

export function validateReviewModels(
  records: LoadedRecord[],
  lifecycle: LifecycleManifest,
): ValidationError[] {
  const activeModels = new Map(
    [...lifecycle.phases, ...lifecycle.reviewers].map(({ owner, model }) => [
      owner,
      model,
    ]),
  );
  const modelPlan = records.find(
    ({ value }) => value.recordType === "model-plan",
  );
  if (modelPlan && Array.isArray(modelPlan.value.assignments)) {
    for (const assignment of modelPlan.value.assignments) {
      if (isModelAssignment(assignment)) {
        activeModels.set(assignment.agent, assignment.model);
      }
    }
  }
  const reviewerOwners = new Map(
    lifecycle.reviewers.map(({ id, owner }) => [id, owner]),
  );
  const phaseOwners = new Map(
    lifecycle.phases.map(({ id, owner }) => [id, owner]),
  );

  return records
    .map(asReview)
    .filter((review): review is Review => review !== undefined)
    .flatMap((review) => {
      const errors: ValidationError[] = [];
      const reviewerOwner = reviewerOwners.get(review.reviewer);
      const expectedReviewerModel = reviewerOwner
        ? activeModels.get(reviewerOwner)
        : undefined;
      if (review.model !== expectedReviewerModel) {
        errors.push({
          file: review.file,
          invariant: "lifecycle-profile-consistency",
          message: `${review.reviewer} review model "${review.model}" differs from the active assignment.`,
          remediation:
            "Use the active lifecycle or human-approved model-plan assignment.",
        });
      }
      if (
        review.reviewer === "AFF-A" &&
        review.model === activeModels.get(phaseOwners.get(review.phaseId) ?? "")
      ) {
        errors.push({
          file: review.file,
          invariant: "reviewer-model-separation",
          message: `AFF-A uses the same model as phase ${review.phaseId}.`,
          remediation:
            "Repeat the review with the declared independent AFF-A model.",
        });
      }

      const expectedPrefix = `reviews/${review.reviewer.toLowerCase()}/${review.phaseId}/round-${review.round}/`;
      if (!review.file.startsWith(expectedPrefix)) {
        errors.push({
          file: review.file,
          invariant: "record-location",
          message: `${review.reviewer} phase/round fields do not match the review directory.`,
          remediation: `Store the record beneath ${expectedPrefix}.`,
        });
      }
      return errors;
    });
}
