import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { hashArtifact } from "../case/hash.js";
import { phaseArtifactNames, type Binding } from "../case/review-records.js";
import { readLifecycle } from "../framework/lifecycle.js";
import { renderApprovalOverview, renderPhaseHtml, renderSolutionOverview } from "../render/index.js";

const synthetic = { syntheticTestEvidence: true, realApproval: false, liveModelCalls: 0, azureActions: 0 };
const marker = "Synthetic contract fixture only. No model review, human decision, deployment, application execution or DECKIO export occurred.";

/** Creates a fresh isolated repository root; never use an existing repository or real case. */
export async function createStandardJourney(projectRoot: string, repositoryRoot: string, includeDecisionHistory = false) {
  await mkdir(repositoryRoot, { recursive: true });
  if ((await readdir(repositoryRoot)).length > 0) throw new Error("Synthetic journey output must be an empty directory.");
  const caseName = "synthetic-standard-journey";
  const artifactPrefix = "synthetic";
  const casePath = `cases/${caseName}`;
  const caseRoot = path.join(repositoryRoot, casePath);
  await mkdir(caseRoot, { recursive: true });
  // Exclusive marker prevents accidental replacement of an existing generated case.
  await writeFile(path.join(caseRoot, "synthetic-fixture.txt"), marker, { flag: "wx" });
  await cp(path.join(projectRoot, "schemas"), path.join(repositoryRoot, "schemas"), { recursive: true });
  await cp(path.join(projectRoot, ".github/agents/AFF-LIFECYCLE.json"), path.join(repositoryRoot, ".github/agents/AFF-LIFECYCLE.json"));
  const lifecycle = await readLifecycle(repositoryRoot);
  const record = (recordType: string, fields: Record<string, unknown>) => ({ schemaVersion: "1.0.0", recordType, caseName, artifactPrefix, ...fields, extensions: synthetic });
  const put = async (file: string, value: unknown) => {
    const absolute = path.join(caseRoot, file);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  };
  const binding = async (file: string): Promise<Binding> => ({ path: file, sha256: await hashArtifact(path.join(caseRoot, file)) });
  const time = (phase: number, minute: number) => new Date(Date.UTC(2026, 0, 1, phase, minute)).toISOString();
  const journal: Record<string, unknown>[] = [];
  const event = (phaseId: string, eventType: string, timestamp: string, actor: string, fields = {}) => journal.push(record("run-journal-event", {
    eventId: `SYN-${journal.length + 1}`, sequence: journal.length + 1, phaseId, eventType, timestamp, actor, summary: `${eventType}: ${marker}`, ...fields,
  }));
  await put("input/brief.md", `# Synthetic permit status service\n\n${marker}\n\nThe toy service returns a permit status for a fixed synthetic identifier.\n`);
  for (const name of ["decisions", "risk-log", "regulatory-register"]) await put(`synthetic-${name}.md`, `# Synthetic ${name}\n\n${marker}\n`);

  for (const phase of lifecycle.phases.filter(({ id }) => Number(id) <= 6)) {
    const number = Number(phase.id);
    const prefix = `${phase.folder}/synthetic-`;
    const names = phaseArtifactNames[phase.id]!;
    const markdown = `${prefix}${names.find((name) => name.endsWith(".md"))!}`;
    const html = markdown.replace(/\.md$/u, ".html");
    const metadata: string[] = [];
    const catalogue = async (filename: string, type: string, fields: Record<string, unknown>) => {
      const file = `${prefix}${filename}.json`;
      await put(file, record(type, fields));
      metadata.push(file);
    };
    await put(markdown, `# ${phase.displayName}\n\n${marker}\n\n## Decision\n\nThis fixture demonstrates record integrity and phase ordering for FR-001.\n\n## Residual limitations\n\nAll business and review content is synthetic; no production readiness is asserted.\n`);
    switch (phase.id) {
      case "0":
        await put("0-coordination/input/brief.md", await readFile(path.join(caseRoot, "input/brief.md"), "utf8"));
        await catalogue("input-inventory", "input-inventory", { sources: [{ sourcePath: "input/brief.md", governedArtifact: await binding("0-coordination/input/brief.md"), readable: true, sensitivity: "Synthetic public fixture" }] });
        await catalogue("model-plan", "model-plan", { assignments: [...lifecycle.phases, ...lifecycle.reviewers].map(({ owner, model }) => ({ agent: owner, model, rationale: marker, available: true, separationStatus: owner === "AFF-A-rubber-duck" ? "SATISFIED" : "NOT-APPLICABLE" })) });
        break;
      case "1":
        await catalogue("requirements-catalogue", "requirements-catalogue", { revision: "synthetic-1", requirements: [{ id: "FR-001", class: "Functional", category: "FR", priority: "Must", status: "Active", owner: "Synthetic architect", statement: "Return a permit status for the synthetic identifier.", rationale: marker, source: "input/brief.md", dependencies: [], derivedFrom: [], acceptanceCriteria: [{ testId: "TEST-001", precondition: "Synthetic permit identifier exists", action: "Call permitStatus", observableOutcome: "Status string returned", expectation: "received", environment: "Offline fixture", evidenceSource: "5-coding/app/permit-status.test.js (not executed by generator)" }] }] });
        await catalogue("interview-decisions", "interview-decisions", { goal: marker, confidence: { ...Object.fromEntries(["business", "data", "application", "technology", "security"].map((domain) => [domain, { score: 100, rationale: "Synthetic closure values, not measured confidence" }])), overall: 100 }, decisions: [{ id: "DEC-001", recordedAt: time(1, 1), domains: ["Business"], source: "input/brief.md", answer: "Use a toy permit service", rationale: marker, owner: "Synthetic architect" }], assumptions: [], nonScope: ["Live workloads", "Real interview"], openItems: [], humanConfirmation: { confirmedBy: "Synthetic harness (not a human)", confirmedAt: time(1, 2) } });
        break;
      case "2":
        await catalogue("architecture-catalogue", "architecture-catalogue", { revision: "synthetic-1", requirementsRevision: "synthetic-1", buildingBlocks: [{ id: "ABB-001", name: "Permit service", requirements: ["FR-001"] }], views: [{ id: "VIEW-001", name: "Synthetic application view", requirements: ["FR-001"] }], decisions: [{ id: "ADR-001", name: "Pure status function", requirements: ["FR-001"], rationale: marker, alternatives: ["No service"], risks: ["Not a production architecture"], implications: ["Offline only"], status: "Synthetic", humanDecisionEvidence: "synthetic-decisions.md" }] });
        break;
      case "3":
        await catalogue("design-catalogue", "azure-design-catalogue", { revision: "synthetic-1", architectureRevision: "synthetic-1", components: [{ id: "DES-001", name: "Synthetic application", buildingBlocks: ["ABB-001"], requirements: ["FR-001"], azureServices: ["Azure Functions (design intent only)"] }], controls: [{ id: "CTRL-001", summary: "No real data or credentials", requirements: ["FR-001"], designElements: ["DES-001"] }], wafAssessments: [{ id: "WAF-001", summary: "Synthetic design only", requirements: ["FR-001"], designElements: ["DES-001"] }], environments: [{ name: "synthetic", parameters: { deploymentEnabled: false } }] });
        break;
      case "4":
        await catalogue("implementation-catalogue", "implementation-catalogue", { revision: "synthetic-1", designRevision: "synthetic-1", units: [{ id: "UNIT-001", name: "Permit status function", dependsOn: [], inputs: ["Synthetic identifier"], outputs: ["Status"], owner: "Synthetic coding owner", stage: "offline", validation: ["node --test (not run by generator)"], rollback: "No deployment to roll back", evidence: ["5-coding/synthetic-validation.txt"], designElements: ["DES-001"], requirements: ["FR-001"] }] });
        break;
      case "5": {
        await put("5-coding/app/package.json", { name: "synthetic-permit-service", version: "0.0.0", private: true, type: "module", scripts: { test: "node --test" } });
        await put("5-coding/app/permit-status.js", "// Synthetic fixture only.\nexport function permitStatus(id) { return id === 'SYN-001' ? 'received' : 'unknown'; }\n");
        await put("5-coding/app/permit-status.test.js", "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { permitStatus } from './permit-status.js';\ntest('synthetic status', () => { assert.equal(permitStatus('SYN-001'), 'received'); assert.equal(permitStatus('missing'), 'unknown'); });\n");
        await put("5-coding/synthetic-validation.txt", `${marker}\nApplication tests deliberately NOT RUN by this generator.\n`);
        await catalogue("release-manifest", "release-manifest", { releaseId: "synthetic-1", createdAt: time(5, 2), artifacts: await Promise.all(["5-coding/app/package.json", "5-coding/app/permit-status.js", "5-coding/app/permit-status.test.js"].map(binding)), validationChecks: [{ name: "Synthetic application test placeholder", command: "NOT RUN: node --test", exitCode: 1, status: "BLOCKED", evidencePath: "5-coding/synthetic-validation.txt" }], deploymentProcedure: await binding("4-implementation-plan/synthetic-implementation-plan.md") });
        break;
      }
      case "6":
        await catalogue("claim-catalogue", "claim-catalogue", { claims: [{ id: "CLAIM-001", claim: "A toy status function exists; runtime and DECKIO export have not been tested.", evidenceType: "UNTESTED-RUNTIME", source: await binding("5-coding/app/permit-status.js"), status: "QUALIFIED" }] });
        await put("6-presentation/deck/README.md", `# Synthetic presentation boundary\n\n${marker}\n\nNo DECKIO source or PDF export is fabricated. The phase narrative HTML exercises AFF rendering only.\n`);
        break;
    }
    await renderPhaseHtml({ caseRoot, phaseId: phase.id, sourcePath: markdown, outputPath: html, metadataPaths: metadata });
    const files = (await fg(`${phase.folder}/**/*`, { cwd: caseRoot, onlyFiles: true })).sort();
    const artifacts = await Promise.all(files.map(binding));
    event(phase.id, "PHASE-ENTERED", time(number, 0), phase.owner);
    event(phase.id, "ARTIFACTS-RECORDED", time(number, 3), phase.owner, { artifactHashes: artifacts });
    const reviewBindings: Binding[] = [];
    for (const [index, reviewer] of lifecycle.reviewers.entries()) {
      const file = `reviews/${reviewer.id.toLowerCase()}/${phase.id}/round-1/synthetic-review.json`;
      await put(file, record("review-record", { reviewer: reviewer.id, model: reviewer.model, phaseId: phase.id, round: 1, final: true, subjectArtifacts: artifacts, confirmedItems: [marker], findings: [], verdict: "CONFORMS-WITH-GAPS", rationale: marker, reviewedAt: time(number, 4 + index), residualGaps: [marker], requiredActions: [] }));
      reviewBindings.push(await binding(file));
    }
    event(phase.id, "REVIEW-RECORDED", time(number, 6), phase.owner, { reviewHashes: reviewBindings });
    const approvalFile = `approvals/phase-${phase.id}/synthetic-approval.json`;
    if (includeDecisionHistory && phase.id === "1") {
      await put("approvals/phase-1/synthetic-prior-rejection.json", {
        ...record("human-approval", { phaseId: "1", artifactHashes: artifacts, reviewRecords: reviewBindings,
          decision: "REJECTED", approver: "Synthetic harness (not a human)",
          decidedAt: time(number, 6).replace(":00.000Z", ":30.000Z"), residualGapAcceptance: [] }),
        extensions: { ...synthetic, approvalMode: "synthetic" },
      });
    }
    await put(approvalFile, { ...record("human-approval", { phaseId: phase.id, artifactHashes: artifacts, reviewRecords: reviewBindings, decision: "APPROVED", approver: "Synthetic harness (not a human)", decidedAt: time(number, 7), residualGapAcceptance: [marker] }), extensions: { ...synthetic, approvalMode: "synthetic" } });
    event(phase.id, "HUMAN-DECISION", time(number, 7), "Synthetic harness (not a human)", { decision: "APPROVED", artifactHashes: artifacts, reviewHashes: reviewBindings });
    event(phase.id, "PHASE-EXITED", time(number, 8), phase.owner);
  }
  await put("synthetic-run-journal.jsonl", `${journal.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  await renderSolutionOverview({ repositoryRoot, casePath });
  await renderApprovalOverview({ repositoryRoot, casePath });
  return { repositoryRoot, caseRoot, casePath, liveModelCalls: 0, azureActions: 0, syntheticApproval: true, applicationTestsExecuted: false, deckioExportExecuted: false };
}
