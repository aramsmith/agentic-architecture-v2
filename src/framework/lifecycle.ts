import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  LifecycleManifest,
  LifecyclePhase,
  LifecycleReviewer,
  ValidationError,
} from "../types.js";

const lifecycleFile = ".github/agents/AFF-LIFECYCLE.json";
type ExpectedPhase = readonly [string, string, string, string, string];
const expectedPhases = new Map<string, ExpectedPhase>([
  ["0", ["coordination", "Phase 0 — Coordinate", "AFF-0-coordinator", "gpt-5.6-sol", "0-coordination"]],
  ["1", ["requirements", "Phase 1 — Requirements", "AFF-1-requirements", "gpt-5.6-sol", "1-requirements"]],
  ["2", ["togaf-architecture", "Phase 2 — TOGAF Architecture", "AFF-2-togafarchitecture", "gpt-5.6-sol", "2-togaf-architecture"]],
  ["3", ["azure-design", "Phase 3 — Azure Design", "AFF-3-design", "gpt-5.6-sol", "3-azure-design"]],
  ["4", ["implementation-plan", "Phase 4 — Implementation Plan", "AFF-4-implementation-plan", "gpt-5.6-sol", "4-implementation-plan"]],
  ["5", ["coding", "Phase 5 — Coding", "AFF-5-coding", "gpt-5.3-codex", "5-coding"]],
  ["6", ["presentation", "Phase 6 — C-level Presentation", "AFF-6-presentation", "gpt-5.6-sol", "6-presentation"]],
  ["7", ["deployment", "Phase 7 — Deployment", "AFF-7-deployer", "gpt-5.6-sol", "7-deployment"]],
  ["8", ["runtime-testing", "Phase 8 — Runtime Testing", "AFF-8-testing", "gpt-5.3-codex", "8-testing"]],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPhase(value: unknown): value is LifecyclePhase {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.displayName === "string" &&
    typeof value.owner === "string" &&
    typeof value.model === "string" &&
    typeof value.folder === "string" &&
    (typeof value.next === "string" || value.next === null) &&
    typeof value.humanInvocableOnly === "boolean" &&
    (value.requires === undefined ||
      (Array.isArray(value.requires) &&
        value.requires.every((item) => typeof item === "string")))
  );
}

function isReviewer(value: unknown): value is LifecycleReviewer {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.displayName === "string" &&
    typeof value.owner === "string" &&
    typeof value.model === "string" &&
    typeof value.mustDifferFromPhaseOwner === "boolean"
  );
}

function isLifecycleManifest(value: unknown): value is LifecycleManifest {
  return (
    isRecord(value) &&
    typeof value.schemaVersion === "string" &&
    value.recordType === "lifecycle-manifest" &&
    typeof value.version === "string" &&
    typeof value.contract === "string" &&
    Array.isArray(value.standardRoute) &&
    value.standardRoute.every((item) => typeof item === "string") &&
    Array.isArray(value.reviewOrder) &&
    value.reviewOrder.every((item) => typeof item === "string") &&
    Array.isArray(value.phases) &&
    value.phases.every(isPhase) &&
    Array.isArray(value.reviewers) &&
    value.reviewers.every(isReviewer) &&
    isRecord(value.artifactRules) &&
    typeof value.artifactRules.phaseMarkdown === "string" &&
    typeof value.artifactRules.phaseHtml === "string" &&
    typeof value.artifactRules.solutionOverview === "string" &&
    typeof value.artifactRules.phaseHtmlSelfContained === "boolean" &&
    typeof value.artifactRules.humanReadableOutputsCompact === "boolean" &&
    isRecord(value.executionRules) &&
    typeof value.executionRules.iacDefault === "string" &&
    typeof value.executionRules.githubOidcAllowed === "boolean" &&
    typeof value.executionRules.storedCredentialsAllowed === "boolean" &&
    typeof value.executionRules.phase5DeploymentAllowed === "boolean" &&
    typeof value.executionRules.databasePublicAccessAllowed === "boolean" &&
    typeof value.executionRules.environmentCodeForksAllowed === "boolean"
  );
}

export async function readLifecycle(repositoryRoot: string): Promise<LifecycleManifest> {
  const content = await readFile(path.join(repositoryRoot, lifecycleFile), "utf8");
  const parsed: unknown = JSON.parse(content);

  if (!isLifecycleManifest(parsed)) {
    throw new TypeError(`${lifecycleFile} does not contain the required lifecycle fields.`);
  }

  return parsed;
}

export function validateReviewerModelSeparation(
  lifecycle: LifecycleManifest,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const reviewer of lifecycle.reviewers.filter(
    ({ mustDifferFromPhaseOwner }) => mustDifferFromPhaseOwner,
  )) {
    const matchingPhases = lifecycle.phases
      .filter(({ model }) => model === reviewer.model)
      .map(({ id }) => id);

    if (matchingPhases.length > 0) {
      errors.push({
        file: lifecycleFile,
        invariant: "reviewer-model-separation",
        message: `${reviewer.id} uses ${reviewer.model}, which also owns phase(s) ${matchingPhases.join(", ")}.`,
        remediation: `Assign ${reviewer.id} a GPT model that differs from every phase owner and update its profile consistently.`,
      });
    }
  }

  return errors;
}

export function validateLifecycleRouting(
  lifecycle: LifecycleManifest,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const phases = new Map(lifecycle.phases.map((phase) => [phase.id, phase]));
  const expectedIds = ["0", "1", "2", "3", "4", "5", "6", "7", "8"];
  const actualIds = [...phases.keys()].sort();
  const expectedReviewOrder = [
    "phase-agent",
    "AFF-A",
    "phase-agent-remediation",
    "AFF-B",
    "phase-agent-remediation",
    "AFF-A-and-AFF-B-same-hash-convergence",
    "human-approval",
  ];

  if (actualIds.join(",") !== expectedIds.join(",")) {
    errors.push({
      file: lifecycleFile,
      invariant: "lifecycle-route-consistency",
      message: `Lifecycle phase IDs are "${actualIds.join(", ")}", expected 0 through 8 exactly once.`,
      remediation: "Restore one manifest entry for every AFF phase from 0 through 8.",
    });
  }
  if (lifecycle.reviewOrder.join("\n") !== expectedReviewOrder.join("\n")) {
    errors.push({
      file: lifecycleFile,
      invariant: "lifecycle-route-consistency",
      message: "Lifecycle reviewOrder no longer matches the mandatory assurance sequence.",
      remediation:
        "Restore phase agent, AFF-A, remediation, AFF-B, remediation, convergence, then human approval.",
    });
  }

  const reviewers = new Map(
    lifecycle.reviewers.map((reviewer) => [reviewer.id, reviewer]),
  );
  if (
    reviewers.size !== 2 ||
    reviewers.get("AFF-A")?.owner !== "AFF-A-rubber-duck" ||
    reviewers.get("AFF-A")?.displayName !== "Rubber Duck Reviewer" ||
    reviewers.get("AFF-A")?.model !== "gpt-5.4" ||
    reviewers.get("AFF-A")?.mustDifferFromPhaseOwner !== true ||
    reviewers.get("AFF-B")?.owner !== "AFF-B-security-compliance" ||
    reviewers.get("AFF-B")?.displayName !==
      "Security and Compliance Reviewer" ||
    reviewers.get("AFF-B")?.model !== "gpt-5.6-sol" ||
    reviewers.get("AFF-B")?.mustDifferFromPhaseOwner !== false
  ) {
    errors.push({
      file: lifecycleFile,
      invariant: "lifecycle-route-consistency",
      message: "Declared reviewers or AFF-A independence flags have drifted.",
      remediation:
        "Declare AFF-A and AFF-B exactly once and keep AFF-A model separation mandatory.",
    });
  }

  const owners = new Set<string>();
  const folders = new Set<string>();
  for (const phase of lifecycle.phases) {
    if (owners.has(phase.owner) || folders.has(phase.folder)) {
      errors.push({
        file: lifecycleFile,
        invariant: "lifecycle-route-consistency",
        message: `Phase ${phase.id} repeats an owner or folder used by another phase.`,
        remediation: "Assign one unique owner profile and one unique folder to each phase.",
      });
    }
    owners.add(phase.owner);
    folders.add(phase.folder);
    const expected = expectedPhases.get(phase.id);

    if (
      !expected ||
      phase.name !== expected[0] ||
      phase.displayName !== expected[1] ||
      phase.owner !== expected[2] ||
      phase.model !== expected[3] ||
      phase.folder !== expected[4] ||
      !phase.owner.startsWith(`AFF-${phase.id}-`) ||
      !phase.folder.startsWith(`${phase.id}-`) ||
      !phase.displayName.startsWith(`Phase ${phase.id}`)
    ) {
      errors.push({
        file: lifecycleFile,
        invariant: "lifecycle-route-consistency",
        message: `Phase ${phase.id} owner, folder, or display name does not identify the same phase.`,
        remediation:
          "Align the phase ID with its AFF owner name, numbered folder, and display name.",
      });
    }
  }

  for (const [index, phaseId] of lifecycle.standardRoute.entries()) {
    const phase = phases.get(phaseId);
    const expectedNext = lifecycle.standardRoute[index + 1] ?? null;
    if (!phase || phase.humanInvocableOnly || phase.next !== expectedNext) {
      errors.push({
        file: lifecycleFile,
        invariant: "lifecycle-route-consistency",
        message: `Standard-route phase ${phaseId} must route to ${expectedNext ?? "end"} and must not be human-invocable-only.`,
        remediation:
          "Restore the 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 standard route.",
      });
    }
  }

  for (const phase of lifecycle.phases.filter(
    ({ id }) => !lifecycle.standardRoute.includes(id),
  )) {
    if (!phase.humanInvocableOnly) {
      errors.push({
        file: lifecycleFile,
        invariant: "lifecycle-route-consistency",
        message: `Optional phase ${phase.id} is not marked human-invocable-only.`,
        remediation: "Keep Phases 7 and 8 behind explicit human invocation.",
      });
    }
    if (phase.next !== null && !phases.get(phase.next)?.humanInvocableOnly) {
      errors.push({
        file: lifecycleFile,
        invariant: "lifecycle-route-consistency",
        message: `Optional phase ${phase.id} routes automatically into a non-optional phase.`,
        remediation:
          "Optional routes may target only another human-invocable phase or end.",
      });
    }
  }

  const phase7Requires = new Set([
    "approved-phase-6",
    "scoped-attempt-authorisation",
  ]);
  const phase8Requires = new Set([
    "phase-7-succeeded",
    "approved-phase-7",
    "scoped-test-attempt-authorisation",
  ]);
  const hasExactRequirements = (
    phaseId: string,
    expected: Set<string>,
  ): boolean => {
    const requires = phases.get(phaseId)?.requires ?? [];
    return (
      requires.length === expected.size &&
      requires.every((requirement) => expected.has(requirement))
    );
  };
  if (
    !hasExactRequirements("7", phase7Requires) ||
    !hasExactRequirements("8", phase8Requires)
  ) {
    errors.push({
      file: lifecycleFile,
      invariant: "lifecycle-route-consistency",
      message: "Phase 7 or 8 human prerequisites have drifted.",
      remediation:
        "Restore the approved phase, successful deployment, and scoped attempt authorisation requirements.",
    });
  }

  const execution = lifecycle.executionRules;
  const artifacts = lifecycle.artifactRules;
  if (
    artifacts.phaseMarkdown !==
      "<phase-folder>/<artifactPrefix>-<artifact>.md" ||
    artifacts.phaseHtml !==
      "<phase-folder>/<artifactPrefix>-<artifact>.html" ||
    artifacts.solutionOverview !== "solution-overview.html" ||
    !artifacts.phaseHtmlSelfContained ||
    !artifacts.humanReadableOutputsCompact
  ) {
    errors.push({
      file: lifecycleFile,
      invariant: "lifecycle-route-consistency",
      message: "Lifecycle artifact naming or rendering rules have drifted.",
      remediation:
        "Restore the canonical phase paths, self-contained HTML, compact outputs, and solution overview name.",
    });
  }
  if (
    execution.iacDefault !== "Bicep" ||
    execution.githubOidcAllowed ||
    execution.storedCredentialsAllowed ||
    execution.phase5DeploymentAllowed ||
    execution.databasePublicAccessAllowed ||
    execution.environmentCodeForksAllowed
  ) {
    errors.push({
      file: lifecycleFile,
      invariant: "lifecycle-execution-policy",
      message: "Lifecycle execution safety controls have been weakened.",
      remediation:
        "Restore Bicep default, no GitHub OIDC or stored credentials, no Phase 5 deployment, private databases, and one environment-neutral codebase.",
    });
  }

  return errors;
}
