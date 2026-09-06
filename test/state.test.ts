import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { activeApproval, phaseStatus } from "../src/case/state.js";
import { validatePhaseSequence } from "../src/case/sequence.js";
import { readLifecycle } from "../src/framework/lifecycle.js";
import type { LoadedRecord } from "../src/case/records.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bindings = [{ path: "input/brief.md", sha256: "a".repeat(64) }];
const reviews: LoadedRecord[] = ["0", "1"].flatMap((phaseId) => ["AFF-A", "AFF-B"].map((reviewer) => ({
  file: `${phaseId}-${reviewer}.json`, absolutePath: "/tmp/unused", snapshotSha256: "a".repeat(64),
  value: { recordType: "review-record", phaseId, reviewer, model: "test", round: 1, final: true,
    verdict: "CONVERGES", subjectArtifacts: bindings, reviewedAt: "2026-01-01T00:00:00Z" },
})));
function record(value: Record<string, unknown>): LoadedRecord {
  return { file: `${value.recordType}-${value.phaseId}-${value.sequence ?? value.decidedAt}.json`,
    absolutePath: "/tmp/unused", snapshotSha256: "a".repeat(64), value };
}
function approval(phaseId = "0", decidedAt = "2026-01-02T00:00:00Z") {
  return record({ recordType: "human-approval", phaseId, decidedAt, decision: "APPROVED", approver: "Architect",
    artifactHashes: bindings, reviewRecords: reviews.filter(({ value }) => value.phaseId === phaseId)
      .map(({ file }) => ({ path: file, sha256: "a".repeat(64) })) });
}
function event(eventType: string, phaseId = "0", timestamp = "2026-01-03T00:00:00Z", sequence = 1) {
  return record({ recordType: "run-journal-event", phaseId, eventType, timestamp, sequence });
}

describe("shared lifecycle state", () => {
  it.each(["PHASE-REOPENED", "BLOCKER"])("withdraws gate approval after %s", (type) => {
    const records = [...reviews, approval(), event(type)];
    expect(activeApproval(records, "0")).toBeUndefined();
    expect(phaseStatus(records, "0").state).toBe(type === "BLOCKER" ? "Blocked" : "Reopened");
    expect(activeApproval(records, "0", Date.parse("2026-01-02T12:00:00Z"))).toBeDefined();
  });
  it("restores the gate after a later decision while preserving history", () => {
    const records = [...reviews, approval(), event("PHASE-REOPENED"), approval("0", "2026-01-04T00:00:00Z")];
    expect(activeApproval(records, "0")?.decidedAt).toBe("2026-01-04T00:00:00Z");
    expect(phaseStatus(records, "0").state).toBe("Approved");
  });
  it("blocks downstream progression after reopening", async () => {
    const records = [...reviews, approval(), approval("1", "2026-01-02T12:00:00Z"), event("PHASE-REOPENED")];
    expect(validatePhaseSequence(records, await readLifecycle(root)).some(({ message }) =>
      message.includes("no longer active"))).toBe(true);
  });
  it("does not let a later approval legitimise premature entry", async () => {
    const records = [...reviews, event("PHASE-ENTERED", "1", "2026-01-01T00:00:00Z"), approval()];
    expect(validatePhaseSequence(records, await readLifecycle(root)).some(({ message }) =>
      message.includes("occurred before an active approval"))).toBe(true);
  });
  it("accepts entry after predecessor approval", async () => {
    const records = [...reviews, approval(), event("PHASE-ENTERED", "1")];
    expect(validatePhaseSequence(records, await readLifecycle(root))).toEqual([]);
  });
});
