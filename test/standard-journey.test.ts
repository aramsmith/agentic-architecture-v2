import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createStandardJourney } from "./helpers/standard-journey.js";
import { validateCase } from "../src/case/index.js";
import { loadCaseRecords } from "../src/case/records.js";
import { activeApproval, phaseStatus } from "../src/case/state.js";
import { renderApprovalOverview } from "../src/render/index.js";
import { prepareApproval, recordSignedDecision } from "../src/approve/prepare.js";
import { createIdentity } from "../src/identity/keys.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "aff-standard-journey-"));
  roots.push(root);
  return createStandardJourney(projectRoot, root);
}
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("synthetic standard journey", () => {
  it("lets one architect recover the full predecessor chain without overwriting history", async () => {
    const journey = await fixture();
    const home = path.join(journey.repositoryRoot, "test-identity");
    const passphrase = "temporary regression identity only";
    await createIdentity({ home, label: "Synthetic test architect", passphrase });
    const original = await readFile(path.join(journey.caseRoot, "approvals/phase-0/synthetic-approval.json"), "utf8");
    await appendFile(path.join(journey.caseRoot, "synthetic-run-journal.jsonl"), `${JSON.stringify({
      schemaVersion: "1.0.0", recordType: "run-journal-event", caseName: "synthetic-standard-journey",
      artifactPrefix: "synthetic", eventId: "RECOVERY-REOPEN", sequence: 43,
      timestamp: "2026-01-02T00:00:00Z", phaseId: "0", eventType: "PHASE-REOPENED",
      actor: "Synthetic test architect", summary: "Synthetic reopening to test sequential recovery",
    })}\n`);
    for (let phase = 0; phase <= 6; phase++) {
      // Fresh independent review records after the reopening/upstream decision.
      for (const reviewer of ["aff-a", "aff-b"]) {
        const originalReview = JSON.parse(await readFile(path.join(journey.caseRoot,
          `reviews/${reviewer}/${phase}/round-1/synthetic-review.json`), "utf8"));
        const directory = path.join(journey.caseRoot, `reviews/${reviewer}/${phase}/round-2`);
        await mkdir(directory);
        await writeFile(path.join(directory, "synthetic-review.json"), JSON.stringify({ ...originalReview,
          round: 2, reviewedAt: `2026-01-${String(phase + 3).padStart(2, "0")}T00:00:00Z` }));
      }
      const context = await prepareApproval({ repositoryRoot: journey.repositoryRoot, casePath: journey.casePath,
        phaseId: String(phase), home });
      await recordSignedDecision({ context, decision: "APPROVED", passphrase, home,
        decidedAt: `2026-01-${String(phase + 3).padStart(2, "0")}T00:01:00Z` });
    }
    expect((await validateCase(journey.repositoryRoot, journey.casePath, { home })).errors).toEqual([]);
    expect(await readFile(path.join(journey.caseRoot, "approvals/phase-0/synthetic-approval.json"), "utf8")).toBe(original);
    expect((await loadCaseRecords(journey.repositoryRoot, journey.caseRoot)).records.filter(({ value }) =>
      value.recordType === "human-approval")).toHaveLength(14);
  });
  it("validates Phase 0–6 artifacts and gates including ordinary application JSON", async () => {
    const journey = await fixture();
    expect((await validateCase(journey.repositoryRoot, journey.casePath)).errors).toEqual([]);
    const loaded = await loadCaseRecords(journey.repositoryRoot, journey.caseRoot);
    for (let phase = 0; phase <= 6; phase++) expect(phaseStatus(loaded.records, String(phase)).state).toBe("Synthetic test approval and exited");
    expect(loaded.records.filter(({ value }) => value.recordType === "human-approval")).toHaveLength(7);
    expect(loaded.records.filter(({ value }) => value.recordType === "review-record")).toHaveLength(14);
    expect(loaded.records.some(({ file }) => file.endsWith("app/package.json"))).toBe(false);
    expect(journey.liveModelCalls).toBe(0);
    expect(journey.azureActions).toBe(0);
    expect(journey.applicationTestsExecuted).toBe(false);
    expect(journey.deckioExportExecuted).toBe(false);
  });

  it("detects application tampering and withholds dashboard readiness", async () => {
    const journey = await fixture();
    await appendFile(path.join(journey.caseRoot, "5-coding/app/permit-status.js"), "// tampered\n");
    expect((await validateCase(journey.repositoryRoot, journey.casePath)).errors.length).toBeGreaterThan(0);
    await renderApprovalOverview(journey);
    const html = await readFile(path.join(journey.caseRoot, "approval-overview.html"), "utf8");
    expect(html).toContain("not validated approval or permission to continue");
  });

  it.each(["rejection", "reopening"])("invalidates predecessor readiness after %s", async (change) => {
    const journey = await fixture();
    if (change === "rejection") {
      const approval = JSON.parse(await readFile(path.join(journey.caseRoot, "approvals/phase-1/synthetic-approval.json"), "utf8"));
      await writeFile(path.join(journey.caseRoot, "approvals/phase-1/synthetic-rejection.json"), JSON.stringify({ ...approval, decision: "REJECTED", decidedAt: "2026-01-02T00:00:00Z" }));
    } else {
      await appendFile(path.join(journey.caseRoot, "synthetic-run-journal.jsonl"), `${JSON.stringify({ schemaVersion: "1.0.0", recordType: "run-journal-event", caseName: "synthetic-standard-journey", artifactPrefix: "synthetic", eventId: "SYN-REOPEN", sequence: 43, timestamp: "2026-01-02T00:00:00Z", phaseId: "1", eventType: "PHASE-REOPENED", actor: "AFF-1-requirements", summary: "Synthetic reopening" })}\n`);
    }
    const records = (await loadCaseRecords(journey.repositoryRoot, journey.caseRoot)).records;
    expect(activeApproval(records, "1")).toBeUndefined();
    expect(phaseStatus(records, "1").state).toBe(change === "rejection" ? "Rejected" : "Reopened");
    expect((await validateCase(journey.repositoryRoot, journey.casePath)).errors.some(({ invariant }) => invariant === "phase-sequence")).toBe(true);
  });
});
