import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { hashArtifact } from "../case/hash.js";
import { validateCase } from "../case/index.js";
import { bindingSet, type Binding } from "../case/review-records.js";
import { isRecord } from "../common/json.js";
import { validateFramework } from "../framework/index.js";
import { readLifecycle } from "../framework/lifecycle.js";
import { renderPhaseHtml, renderSolutionOverview } from "../render/index.js";

const CASE_PATH = "cases/contoso-permit-services";
const CASE_NAME = "contoso-permit-services";
const ARTIFACT_PREFIX = "contoso";
const QUESTION =
  "Which measurable business outcome must the permit service achieve first, and who owns that measure?";
const ACTIONS_PERFORMED = [
  "framework-static-verification",
  "source-inventory",
  "canonical-hashing",
  "deterministic-record-generation",
  "schema-and-contract-validation",
  "safe-html-rendering",
  "routing-readiness-check",
];

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export interface ContosoSmokeOptions {
  repositoryRoot: string;
  keepOutputPath?: string;
}

export interface ContosoSmokeResult {
  boundary: string;
  syntheticEvidenceNotice: string;
  assertionsPassed: number;
  liveModelCalls: number;
  azureActions: number;
  questionsEmitted: string[];
  requirementsBaselined: string[];
  routeReady: string;
  syntheticApproval: boolean;
  phase7Or8Routed: boolean;
  actionsPerformed: string[];
  actionsNotPerformed: string[];
}

interface Expectations {
  mustHold: string[];
  mustNotOccur: string[];
}

interface SmokeEvidence {
  frameworkValid: boolean;
  caseValid: boolean;
  aff0Discovered: boolean;
  renderSkillDiscovered: boolean;
  grillSkillDiscovered: boolean;
  aff1LoadsGrill: boolean;
  sourceInventoryCurrent: boolean;
  modelMatrixCurrent: boolean;
  affASeparated: boolean;
  candidateHashesConverged: boolean;
  approvalHashesConverged: boolean;
  approvalSynthetic: boolean;
  approvalLastGateAction: boolean;
  phase1AfterApproval: boolean;
  openingActorAff1: boolean;
  questions: string[];
  requirements: string[];
  phaseMarkdownExists: boolean;
  phaseHtmlExists: boolean;
  overviewExists: boolean;
  overviewApproved: boolean;
  routeReady: string;
  phase7Or8Routed: boolean;
  deploymentAttempted: boolean;
  runtimeTestingAttempted: boolean;
  actionsPerformed: string[];
  actionsNotPerformed: string[];
}

export class SmokeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SmokeError";
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function asBindings(value: unknown): Binding[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is Binding =>
      isRecord(entry) &&
      typeof entry.path === "string" &&
      typeof entry.sha256 === "string",
  );
}

async function copySmokeFoundation(
  repositoryRoot: string,
  workspaceRoot: string,
): Promise<void> {
  await Promise.all([
    cp(path.join(repositoryRoot, ".github"), path.join(workspaceRoot, ".github"), {
      recursive: true,
    }),
    cp(path.join(repositoryRoot, "schemas"), path.join(workspaceRoot, "schemas"), {
      recursive: true,
    }),
    cp(path.join(repositoryRoot, "docs"), path.join(workspaceRoot, "docs"), {
      recursive: true,
    }),
    cp(path.join(repositoryRoot, "README.md"), path.join(workspaceRoot, "README.md")),
    cp(path.join(repositoryRoot, "cases"), path.join(workspaceRoot, "cases"), {
      recursive: true,
    }),
  ]);
}

function phaseZeroMarkdown(): string {
  return `# Phase 0 - Coordinate

> Synthetic test evidence only. This offline smoke journey is not a real architecture approval and does not test a live model.

## Scope

The journey inventories the committed Contoso brief, fixes the approved model matrix, creates deterministic Phase 0 records, exercises independent review and synthetic approval bindings, renders safe HTML, and prepares routing to AFF-1.

## Source readiness

| Source | Treatment | State |
| --- | --- | --- |
| \`input/architecture-brief.md\` | Canonical UTF-8 Markdown hash | Ready |

[Read the governed architecture brief](../input/architecture-brief.md).

## Model and reviewer boundary

AFF-0 and AFF-1 use \`gpt-5.6-sol\`. AFF-A uses the separately assigned \`gpt-5.4\`. This harness validates assignments but makes zero model calls.

## Assurance route

\`\`\`mermaid
flowchart LR
  Candidate --> AFF-A
  Candidate --> AFF-B
  AFF-A --> SyntheticApproval
  AFF-B --> SyntheticApproval
  SyntheticApproval --> AFF-1
\`\`\`

## Explicit non-actions

No deployment, Azure access, live runtime test, credential storage, GitHub OIDC, public database access, or Phase 7/8 routing occurs. Phase 1 opens only far enough to load \`grill-me\` and emit one question. No requirement is inferred or baselined.
`;
}

function modelPlan(
  lifecycle: Awaited<ReturnType<typeof readLifecycle>>,
): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    recordType: "model-plan",
    caseName: CASE_NAME,
    artifactPrefix: ARTIFACT_PREFIX,
    assignments: [...lifecycle.phases, ...lifecycle.reviewers].map((entry) => ({
      agent: entry.owner,
      model: entry.model,
      rationale:
        entry.owner === "AFF-A-rubber-duck"
          ? "Independent deterministic smoke-review assignment"
          : "Pinned lifecycle assignment verified by the offline smoke harness",
      available: true,
      separationStatus:
        entry.owner === "AFF-A-rubber-duck"
          ? "SATISFIED"
          : "NOT-APPLICABLE",
    })),
  };
}

function reviewRecord(
  reviewer: "AFF-A" | "AFF-B",
  model: string,
  artifacts: Binding[],
): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    recordType: "review-record",
    caseName: CASE_NAME,
    artifactPrefix: ARTIFACT_PREFIX,
    reviewer,
    model,
    phaseId: "0",
    round: 1,
    final: true,
    subjectArtifacts: artifacts,
    confirmedItems: [
      "Synthetic Phase 0 candidate hashes are complete and unchanged.",
      "The journey remains offline and performs no Azure or live-model action.",
    ],
    findings: [],
    verdict: "CONFORMS",
    rationale:
      reviewer === "AFF-A"
        ? "Deterministic smoke evidence preserves the Phase 0 logic and routing boundary."
        : "Deterministic smoke evidence preserves the security, credential, and deployment boundary.",
    reviewedAt:
      reviewer === "AFF-A"
        ? "2026-01-01T09:03:00Z"
        : "2026-01-01T09:04:00Z",
    residualGaps: [
      "This is an offline contract harness and does not evidence live model quality.",
    ],
    requiredActions: [],
  };
}

function journalEvent(
  sequence: number,
  phaseId: string,
  eventType: string,
  actor: string,
  summary: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    recordType: "run-journal-event",
    caseName: CASE_NAME,
    artifactPrefix: ARTIFACT_PREFIX,
    eventId: `CONTOSO-SMOKE-${String(sequence).padStart(3, "0")}`,
    sequence,
    timestamp: new Date(Date.UTC(2026, 0, 1, 9, sequence)).toISOString(),
    phaseId,
    eventType,
    actor,
    summary,
    ...extra,
  };
}

export async function buildContosoSmokeWorkspace(
  sourceRepositoryRoot: string,
  workspaceRoot: string,
): Promise<void> {
  await copySmokeFoundation(sourceRepositoryRoot, workspaceRoot);
  const framework = await validateFramework(workspaceRoot);
  if (framework.errors.length > 0) {
    throw new SmokeError(
      `Framework static verification failed: ${framework.errors[0]?.message ?? "unknown error"}`,
    );
  }

  const caseRoot = path.join(workspaceRoot, ...CASE_PATH.split("/"));
  const phaseRoot = path.join(caseRoot, "0-coordination");
  const inputRoot = path.join(caseRoot, "input");
  await mkdir(phaseRoot, { recursive: true });
  const lifecycle = await readLifecycle(workspaceRoot);
  const briefPath = path.join(inputRoot, "architecture-brief.md");
  const briefDetails = await stat(briefPath);
  const briefHash = await hashArtifact(briefPath);

  await writeJson(path.join(phaseRoot, "contoso-input-inventory.json"), {
    schemaVersion: "1.0.0",
    recordType: "input-inventory",
    caseName: CASE_NAME,
    artifactPrefix: ARTIFACT_PREFIX,
    sources: [
      {
        sourcePath: "input/architecture-brief.md",
        governedArtifact: {
          path: "input/architecture-brief.md",
          sha256: briefHash,
          mediaType: "text/markdown",
          sizeBytes: briefDetails.size,
        },
        readable: true,
        normalisationNotes: "Committed synthetic UTF-8 Markdown; no mutation required.",
        sensitivity: "Synthetic test data",
      },
    ],
  });
  await writeJson(
    path.join(phaseRoot, "contoso-model-plan.json"),
    modelPlan(lifecycle),
  );
  await writeFile(
    path.join(phaseRoot, "contoso-coordination.md"),
    phaseZeroMarkdown(),
    "utf8",
  );
  await writeJson(path.join(inputRoot, "smoke-phase-1-opening.json"), {
    evidenceType: "synthetic-offline-smoke",
    actor: "AFF-1-requirements",
    skillLoaded: ".github/skills/grill-me/SKILL.md",
    questionsEmitted: [QUESTION],
    requirementsBaselined: [],
  });
  await writeJson(path.join(inputRoot, "smoke-actions.json"), {
    evidenceType: "synthetic-offline-smoke",
    actionsPerformed: ACTIONS_PERFORMED,
    actionsNotPerformed: [
      "Azure deployment",
      "Live runtime testing",
      "Stored credentials",
      "GitHub OIDC",
      "Public database access",
      "Invented landing-zone topology",
      "Invented legal obligation",
      "Invented requirement",
      "Automatic human approval",
      "C-level claims of deployment or runtime readiness",
    ],
  });

  await renderPhaseHtml({
    caseRoot,
    phaseId: "0",
    sourcePath: "0-coordination/contoso-coordination.md",
    outputPath: "0-coordination/contoso-coordination.html",
    metadataPaths: [
      "0-coordination/contoso-input-inventory.json",
      "0-coordination/contoso-model-plan.json",
    ],
  });

  const candidatePaths = [
    "0-coordination/contoso-coordination.md",
    "0-coordination/contoso-coordination.html",
    "0-coordination/contoso-input-inventory.json",
    "0-coordination/contoso-model-plan.json",
  ];
  const artifactHashes = await Promise.all(
    candidatePaths.map(async (candidatePath) => ({
      path: candidatePath,
      sha256: await hashArtifact(
        path.join(caseRoot, ...candidatePath.split("/")),
      ),
    })),
  );
  artifactHashes.sort((left, right) => ordinalCompare(left.path, right.path));

  const affAPath =
    "reviews/aff-a/0/round-1/contoso-aff-a-review.json";
  const affBPath =
    "reviews/aff-b/0/round-1/contoso-aff-b-review.json";
  await writeJson(
    path.join(caseRoot, ...affAPath.split("/")),
    reviewRecord("AFF-A", "gpt-5.4", artifactHashes),
  );
  await writeJson(
    path.join(caseRoot, ...affBPath.split("/")),
    reviewRecord("AFF-B", "gpt-5.6-sol", artifactHashes),
  );
  const reviewHashes = await Promise.all(
    [affAPath, affBPath].map(async (reviewPath) => ({
      path: reviewPath,
      sha256: await hashArtifact(path.join(caseRoot, ...reviewPath.split("/"))),
    })),
  );
  reviewHashes.sort((left, right) => ordinalCompare(left.path, right.path));

  const approvalPath =
    "approvals/phase-0/contoso-phase-0-synthetic-approval.json";
  await writeJson(path.join(caseRoot, ...approvalPath.split("/")), {
    schemaVersion: "1.0.0",
    recordType: "human-approval",
    caseName: CASE_NAME,
    artifactPrefix: ARTIFACT_PREFIX,
    phaseId: "0",
    artifactHashes,
    reviewRecords: reviewHashes,
    decision: "APPROVED",
    approver: "Synthetic Test Human - not a real approval",
    decidedAt: "2026-01-01T09:05:00Z",
    residualGapAcceptance: [
      "Offline smoke evidence does not demonstrate live model, Azure, deployment, or runtime behavior.",
    ],
    extensions: {
      syntheticTestEvidence: true,
      realApproval: false,
    },
  });

  const events = [
    journalEvent(
      1,
      "0",
      "PHASE-ENTERED",
      "AFF-0-coordinator",
      "Synthetic offline Phase 0 smoke journey started.",
    ),
    journalEvent(
      2,
      "0",
      "ARTIFACTS-RECORDED",
      "AFF-0-coordinator",
      "Complete deterministic Phase 0 candidate recorded.",
      { artifactHashes },
    ),
    journalEvent(
      3,
      "0",
      "REVIEW-RECORDED",
      "AFF-A-rubber-duck",
      "Final independent AFF-A smoke review recorded.",
      { reviewHashes: [reviewHashes[0]] },
    ),
    journalEvent(
      4,
      "0",
      "REVIEW-RECORDED",
      "AFF-B-security-compliance",
      "Final AFF-B smoke review recorded over the same candidate.",
      { reviewHashes: [reviewHashes[1]] },
    ),
    journalEvent(
      5,
      "0",
      "HUMAN-DECISION",
      "Synthetic Test Human - not a real approval",
      "Synthetic test evidence only: Phase 0 approved for smoke routing.",
      {
        artifactHashes,
        reviewHashes,
        decision: "APPROVED",
      },
    ),
    journalEvent(
      6,
      "0",
      "PHASE-EXITED",
      "AFF-0-coordinator",
      "Phase 0 smoke contract exited after synthetic approval.",
    ),
    journalEvent(
      7,
      "1",
      "PHASE-ENTERED",
      "AFF-1-requirements",
      "grill-me loaded and one initial interview question emitted; no requirement baselined.",
    ),
  ];
  await writeFile(
    path.join(caseRoot, "contoso-run-journal.jsonl"),
    `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    "utf8",
  );

  const validation = await validateCase(workspaceRoot, CASE_PATH);
  if (validation.errors.length > 0) {
    throw new SmokeError(
      `Generated Contoso case failed validation: ${validation.errors[0]?.message ?? "unknown error"}`,
    );
  }
  await renderSolutionOverview({
    repositoryRoot: workspaceRoot,
    casePath: CASE_PATH,
  });
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"));
}

async function collectEvidence(workspaceRoot: string): Promise<SmokeEvidence> {
  const caseRoot = path.join(workspaceRoot, ...CASE_PATH.split("/"));
  const framework = await validateFramework(workspaceRoot);
  const caseValidation = await validateCase(workspaceRoot, CASE_PATH);
  const [
    lifecycle,
    expectationsValue,
    inventoryValue,
    modelValue,
    affAValue,
    affBValue,
    approvalValue,
    openingValue,
    actionsValue,
    journalContent,
    aff1Profile,
    overview,
  ] = await Promise.all([
    readLifecycle(workspaceRoot),
    readJson(path.join(caseRoot, "input", "phase-0-test-expectations.json")),
    readJson(path.join(caseRoot, "0-coordination", "contoso-input-inventory.json")),
    readJson(path.join(caseRoot, "0-coordination", "contoso-model-plan.json")),
    readJson(
      path.join(
        caseRoot,
        "reviews",
        "aff-a",
        "0",
        "round-1",
        "contoso-aff-a-review.json",
      ),
    ),
    readJson(
      path.join(
        caseRoot,
        "reviews",
        "aff-b",
        "0",
        "round-1",
        "contoso-aff-b-review.json",
      ),
    ),
    readJson(
      path.join(
        caseRoot,
        "approvals",
        "phase-0",
        "contoso-phase-0-synthetic-approval.json",
      ),
    ),
    readJson(path.join(caseRoot, "input", "smoke-phase-1-opening.json")),
    readJson(path.join(caseRoot, "input", "smoke-actions.json")),
    readFile(path.join(caseRoot, "contoso-run-journal.jsonl"), "utf8"),
    readFile(
      path.join(workspaceRoot, ".github", "agents", "AFF-1-requirements.agent.md"),
      "utf8",
    ),
    readFile(path.join(caseRoot, "solution-overview.html"), "utf8"),
  ]);
  if (
    !isRecord(expectationsValue) ||
    !isRecord(inventoryValue) ||
    !isRecord(modelValue) ||
    !isRecord(affAValue) ||
    !isRecord(affBValue) ||
    !isRecord(approvalValue) ||
    !isRecord(openingValue) ||
    !isRecord(actionsValue)
  ) {
    throw new SmokeError("Generated smoke records must be JSON objects.");
  }
  const events = journalContent
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter(isRecord);
  const phase0DecisionIndex = events.findIndex(
    (event) =>
      event.phaseId === "0" &&
      event.eventType === "HUMAN-DECISION" &&
      event.decision === "APPROVED",
  );
  const phase1EnteredIndex = events.findIndex(
    (event) => event.phaseId === "1" && event.eventType === "PHASE-ENTERED",
  );
  const phase1Entered = events[phase1EnteredIndex];
  const phase0ExitIndex = events.findIndex(
    (event) => event.phaseId === "0" && event.eventType === "PHASE-EXITED",
  );
  const laterPhase0Gate = events
    .slice(phase0DecisionIndex + 1)
    .some(
      (event) =>
        event.phaseId === "0" &&
        [
          "ARTIFACTS-RECORDED",
          "REVIEW-RECORDED",
          "HUMAN-DECISION",
          "BLOCKER",
          "PHASE-REOPENED",
        ].includes(String(event.eventType)),
    );
  const phase0ApprovedTerminal =
    phase0DecisionIndex >= 0 &&
    phase0ExitIndex > phase0DecisionIndex &&
    !laterPhase0Gate;
  const inventorySources = Array.isArray(inventoryValue.sources)
    ? inventoryValue.sources
    : [];
  const governedArtifact = isRecord(inventorySources[0])
    ? inventorySources[0].governedArtifact
    : undefined;
  const briefHash = await hashArtifact(
    path.join(caseRoot, "input", "architecture-brief.md"),
  );
  const assignments = Array.isArray(modelValue.assignments)
    ? modelValue.assignments.filter(isRecord)
    : [];
  const expectedModels = new Map(
    [...lifecycle.phases, ...lifecycle.reviewers].map(({ owner, model }) => [
      owner,
      model,
    ]),
  );
  const modelMatrixCurrent =
    assignments.length === expectedModels.size &&
    assignments.every(
      (assignment) =>
        typeof assignment.agent === "string" &&
        assignment.model === expectedModels.get(assignment.agent),
    );
  const affAAssignment = assignments.find(
    (assignment) => assignment.agent === "AFF-A-rubber-duck",
  );
  const actionsPerformed = Array.isArray(actionsValue.actionsPerformed)
    ? actionsValue.actionsPerformed.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const actionsNotPerformed = Array.isArray(actionsValue.actionsNotPerformed)
    ? actionsValue.actionsNotPerformed.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const questions = Array.isArray(openingValue.questionsEmitted)
    ? openingValue.questionsEmitted.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const requirements = Array.isArray(openingValue.requirementsBaselined)
    ? openingValue.requirementsBaselined.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const affABindings = asBindings(affAValue.subjectArtifacts);
  const affBBindings = asBindings(affBValue.subjectArtifacts);
  const approvalArtifacts = asBindings(approvalValue.artifactHashes);
  const phase7Or8Routed = events.some(
    (event) => event.phaseId === "7" || event.phaseId === "8",
  );
  const deploymentAttempted = events.some(
    (event) => event.eventType === "DEPLOYMENT-ATTEMPT",
  );
  const runtimeTestingAttempted = events.some(
    (event) => event.eventType === "TEST-ATTEMPT",
  );
  return {
    frameworkValid: framework.errors.length === 0,
    caseValid: caseValidation.errors.length === 0,
    aff0Discovered: await fileExists(
      path.join(workspaceRoot, ".github", "agents", "AFF-0-coordinator.agent.md"),
    ),
    renderSkillDiscovered: await fileExists(
      path.join(workspaceRoot, ".github", "skills", "render-case-html", "SKILL.md"),
    ),
    grillSkillDiscovered: await fileExists(
      path.join(workspaceRoot, ".github", "skills", "grill-me", "SKILL.md"),
    ),
    aff1LoadsGrill:
      aff1Profile.includes(".github/skills/grill-me/SKILL.md") &&
      openingValue.skillLoaded === ".github/skills/grill-me/SKILL.md",
    sourceInventoryCurrent:
      isRecord(governedArtifact) && governedArtifact.sha256 === briefHash,
    modelMatrixCurrent,
    affASeparated:
      affAAssignment?.model === "gpt-5.4" &&
      affAAssignment.separationStatus === "SATISFIED" &&
      !lifecycle.phases.some(({ model }) => model === "gpt-5.4"),
    candidateHashesConverged:
      affABindings.length === 4 &&
      bindingSet(affABindings) === bindingSet(affBBindings),
    approvalHashesConverged:
      bindingSet(approvalArtifacts) === bindingSet(affABindings),
    approvalSynthetic:
      isRecord(approvalValue.extensions) &&
      approvalValue.extensions.syntheticTestEvidence === true &&
      approvalValue.extensions.realApproval === false &&
      typeof approvalValue.approver === "string" &&
      approvalValue.approver.startsWith("Synthetic Test Human"),
    approvalLastGateAction: phase0DecisionIndex >= 0 && !laterPhase0Gate,
    phase1AfterApproval:
      phase0ApprovedTerminal &&
      phase1EnteredIndex > phase0ExitIndex &&
      phase1Entered?.actor === "AFF-1-requirements",
    openingActorAff1: openingValue.actor === "AFF-1-requirements",
    questions,
    requirements,
    phaseMarkdownExists: await fileExists(
      path.join(caseRoot, "0-coordination", "contoso-coordination.md"),
    ),
    phaseHtmlExists: await fileExists(
      path.join(caseRoot, "0-coordination", "contoso-coordination.html"),
    ),
    overviewExists: await fileExists(
      path.join(caseRoot, "solution-overview.html"),
    ),
    overviewApproved:
      phase0ApprovedTerminal &&
      overview.includes("Synthetic test approval and exited") &&
      overview.includes("This is not a real human or architecture approval"),
    routeReady:
      lifecycle.phases.find(({ id }) => id === "0")?.next === "1" &&
      phase0ApprovedTerminal &&
      phase1EnteredIndex > phase0ExitIndex &&
      openingValue.actor === "AFF-1-requirements"
        ? "AFF-1"
        : "BLOCKED",
    phase7Or8Routed,
    deploymentAttempted,
    runtimeTestingAttempted,
    actionsPerformed,
    actionsNotPerformed,
  };
}

async function fileExists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function parseExpectations(value: unknown): Expectations {
  if (
    !isRecord(value) ||
    !Array.isArray(value.mustHold) ||
    !value.mustHold.every((entry) => typeof entry === "string") ||
    !Array.isArray(value.mustNotOccur) ||
    !value.mustNotOccur.every((entry) => typeof entry === "string")
  ) {
    throw new SmokeError(
      "phase-0-test-expectations.json must contain string mustHold and mustNotOccur arrays.",
    );
  }
  return {
    mustHold: value.mustHold,
    mustNotOccur: value.mustNotOccur,
  };
}

export async function verifyContosoSmokeWorkspace(
  workspaceRoot: string,
): Promise<ContosoSmokeResult> {
  const caseRoot = path.join(workspaceRoot, ...CASE_PATH.split("/"));
  const expectations = parseExpectations(
    await readJson(path.join(caseRoot, "input", "phase-0-test-expectations.json")),
  );
  const evidence = await collectEvidence(workspaceRoot);
  const mustHoldChecks = new Map<string, boolean>([
    [
      "AFF-0 inventories and hashes the Markdown brief",
      evidence.aff0Discovered && evidence.sourceInventoryCurrent,
    ],
    [
      "AFF-0 prepares but does not conduct the interview",
      evidence.openingActorAff1 &&
        evidence.questions.length === 1 &&
        evidence.requirements.length === 0,
    ],
    [
      "AFF-0 records the approved GPT model matrix",
      evidence.modelMatrixCurrent,
    ],
    [
      "AFF-A uses gpt-5.4 and differs from AFF-0 and AFF-1",
      evidence.affASeparated,
    ],
    [
      "AFF-A and AFF-B final reviews bind to the same artifact hashes",
      evidence.candidateHashesConverged,
    ],
    [
      "The human approval is the last Phase 0 gate action",
      evidence.approvalLastGateAction && evidence.approvalSynthetic,
    ],
    [
      "AFF-1 invokes grill-me only after approved Phase 0",
      evidence.grillSkillDiscovered &&
        evidence.aff1LoadsGrill &&
        evidence.openingActorAff1 &&
        evidence.phase1AfterApproval,
    ],
    [
      "AFF-1 asks one interview question per interaction",
      evidence.openingActorAff1 && evidence.questions.length === 1,
    ],
    [
      "No requirement is baselined from an unconfirmed inference",
      evidence.requirements.length === 0,
    ],
    [
      "Each phase produces compact Markdown and self-contained HTML",
      evidence.phaseMarkdownExists && evidence.phaseHtmlExists,
    ],
    [
      "AFF-0 refreshes solution-overview.html only after human approval",
      evidence.approvalHashesConverged &&
        evidence.overviewExists &&
        evidence.overviewApproved,
    ],
    ["Phase 7 cannot start automatically", !evidence.phase7Or8Routed],
    [
      "Phase 8 cannot start without an approved successful Phase 7 deployment",
      !evidence.phase7Or8Routed && !evidence.deploymentAttempted,
    ],
  ]);
  const mustNotChecks = new Map<string, boolean>([
    ["Azure deployment", !evidence.deploymentAttempted],
    ["Live runtime testing", !evidence.runtimeTestingAttempted],
    [
      "Stored credentials",
      evidence.actionsNotPerformed.includes("Stored credentials"),
    ],
    ["GitHub OIDC", evidence.actionsNotPerformed.includes("GitHub OIDC")],
    [
      "Public database access",
      evidence.actionsNotPerformed.includes("Public database access"),
    ],
    [
      "Invented landing-zone topology",
      evidence.actionsNotPerformed.includes("Invented landing-zone topology"),
    ],
    [
      "Invented legal obligation",
      evidence.actionsNotPerformed.includes("Invented legal obligation"),
    ],
    [
      "Invented requirement",
      evidence.actionsNotPerformed.includes("Invented requirement") &&
        evidence.requirements.length === 0,
    ],
    ["Automatic human approval", evidence.approvalSynthetic],
    [
      "C-level claims of deployment or runtime readiness",
      evidence.actionsNotPerformed.includes(
        "C-level claims of deployment or runtime readiness",
      ),
    ],
  ]);

  if (!evidence.frameworkValid || !evidence.caseValid) {
    throw new SmokeError("Framework or generated case validation failed.");
  }
  if (!evidence.renderSkillDiscovered) {
    throw new SmokeError("render-case-html packaging was not discovered.");
  }
  if (
    evidence.actionsPerformed.length !== ACTIONS_PERFORMED.length ||
    evidence.actionsPerformed.some(
      (action, index) => action !== ACTIONS_PERFORMED[index],
    )
  ) {
    throw new SmokeError(
      "Smoke action evidence contains an unexpected or forbidden action.",
    );
  }
  for (const expectation of expectations.mustHold) {
    if (mustHoldChecks.get(expectation) !== true) {
      throw new SmokeError(`Smoke expectation failed: ${expectation}`);
    }
  }
  for (const expectation of expectations.mustNotOccur) {
    if (mustNotChecks.get(expectation) !== true) {
      throw new SmokeError(`Forbidden smoke behavior detected: ${expectation}`);
    }
  }
  if (
    mustHoldChecks.size !== expectations.mustHold.length ||
    mustNotChecks.size !== expectations.mustNotOccur.length
  ) {
    throw new SmokeError(
      "Committed Contoso expectations and executable assertion coverage have drifted.",
    );
  }

  return {
    boundary:
      "Deterministic offline contract/smoke harness; no live LLM, API, Azure, deployment, or runtime test was executed.",
    syntheticEvidenceNotice:
      "Synthetic test evidence only. The generated approval is never a real human or architecture approval.",
    assertionsPassed:
      expectations.mustHold.length + expectations.mustNotOccur.length,
    liveModelCalls: 0,
    azureActions: 0,
    questionsEmitted: evidence.questions,
    requirementsBaselined: evidence.requirements,
    routeReady: evidence.routeReady,
    syntheticApproval: evidence.approvalSynthetic,
    phase7Or8Routed: evidence.phase7Or8Routed,
    actionsPerformed: evidence.actionsPerformed,
    actionsNotPerformed: evidence.actionsNotPerformed,
  };
}

async function retainOutput(
  workspaceRoot: string,
  destination: string,
  result: ContosoSmokeResult,
): Promise<void> {
  await mkdir(destination, { recursive: true });
  const existing = await readdir(destination);
  if (existing.length > 0) {
    throw new SmokeError(
      `Retained output directory is not empty: ${destination}. Choose an empty directory.`,
    );
  }
  await cp(
    path.join(workspaceRoot, "cases", CASE_NAME),
    path.join(destination, "cases", CASE_NAME),
    { recursive: true },
  );
  await writeJson(path.join(destination, "smoke-report.json"), result);
}

export async function runContosoSmoke(
  options: ContosoSmokeOptions,
): Promise<ContosoSmokeResult> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "aff-contoso-smoke-"));
  try {
    await buildContosoSmokeWorkspace(options.repositoryRoot, workspaceRoot);
    const result = await verifyContosoSmokeWorkspace(workspaceRoot);
    if (options.keepOutputPath) {
      await retainOutput(
        workspaceRoot,
        path.resolve(options.keepOutputPath),
        result,
      );
    }
    return result;
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}
