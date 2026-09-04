import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readLifecycle } from "../src/framework/lifecycle.js";
import type { LoadedRecord } from "../src/case/records.js";
import { validatePhaseSequence } from "../src/case/sequence.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const binding = [
  {
    path: "0-coordination/sample-coordination.md",
    sha256: "a".repeat(64),
  },
];

function record(file: string, value: Record<string, unknown>): LoadedRecord {
  return {
    file,
    absolutePath: path.join(repositoryRoot, file),
    snapshotSha256: "b".repeat(64),
    value,
  };
}

function approval(phaseId: string, decidedAt: string, decision = "APPROVED") {
  return record(`approvals/phase-${phaseId}/sample-approval.json`, {
    schemaVersion: "1.0.0",
    recordType: "human-approval",
    caseName: "sample",
    artifactPrefix: "sample",
    phaseId,
    artifactHashes: binding,
    reviewRecords: binding,
    decision,
    approver: "Human Architect",
    decidedAt,
  });
}

function journalEvent(
  phaseId: string,
  eventType: string,
  sequence: number,
  extra: Record<string, unknown> = {},
) {
  return record(`sample-run-journal.jsonl:${sequence}`, {
    schemaVersion: "1.0.0",
    recordType: "run-journal-event",
    caseName: "sample",
    artifactPrefix: "sample",
    eventId: `EVT-${sequence}`,
    sequence,
    timestamp: "2026-01-01T09:00:00Z",
    phaseId,
    eventType,
    actor: "AFF-0-coordinator",
    summary: "Synthetic event.",
    ...extra,
  });
}

function messages(errors: { message: string }[]): string {
  return errors.map(({ message }) => message).join("\n");
}

describe("phase sequence", () => {
  it("accepts the first phase with no predecessor", async () => {
    const manifest = await readLifecycle(repositoryRoot);

    const errors = validatePhaseSequence(
      [
        approval("0", "2026-01-01T10:00:00Z"),
        journalEvent("0", "ARTIFACTS-RECORDED", 1, {
          artifactHashes: binding,
        }),
      ],
      manifest,
    );

    expect(errors).toEqual([]);
  });

  it("accepts phases approved in lifecycle order", async () => {
    const manifest = await readLifecycle(repositoryRoot);

    const errors = validatePhaseSequence(
      [
        approval("0", "2026-01-01T10:00:00Z"),
        approval("1", "2026-01-02T10:00:00Z"),
        approval("2", "2026-01-03T10:00:00Z"),
      ],
      manifest,
    );

    expect(errors).toEqual([]);
  });

  it("rejects a phase approved while its predecessor has no approval", async () => {
    const manifest = await readLifecycle(repositoryRoot);

    const errors = validatePhaseSequence(
      [approval("1", "2026-01-02T10:00:00Z")],
      manifest,
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual(
      expect.objectContaining({ invariant: "phase-sequence" }),
    );
    expect(messages(errors)).toContain(
      "Phase 1 was approved while phase 0 has no approved human decision",
    );
  });

  it("rejects a phase approved while its predecessor was rejected", async () => {
    const manifest = await readLifecycle(repositoryRoot);

    const errors = validatePhaseSequence(
      [
        approval("0", "2026-01-01T10:00:00Z", "REJECTED"),
        approval("1", "2026-01-02T10:00:00Z"),
      ],
      manifest,
    );

    expect(messages(errors)).toContain(
      "Phase 1 was approved while phase 0 has no approved human decision",
    );
  });

  it("rejects phase entry before the predecessor is approved", async () => {
    const manifest = await readLifecycle(repositoryRoot);

    const errors = validatePhaseSequence(
      [journalEvent("1", "PHASE-ENTERED", 2)],
      manifest,
    );

    expect(messages(errors)).toContain("Phase 1 was entered while phase 0");
  });

  it("rejects candidate artifacts recorded before the predecessor is approved", async () => {
    const manifest = await readLifecycle(repositoryRoot);

    const errors = validatePhaseSequence(
      [
        approval("0", "2026-01-01T10:00:00Z"),
        journalEvent("2", "ARTIFACTS-RECORDED", 5, {
          artifactHashes: binding,
        }),
      ],
      manifest,
    );

    expect(messages(errors)).toContain(
      "Phase 2 recorded candidate artifacts while phase 1 has no approved human decision",
    );
  });

  it("rejects an approval recorded before its predecessor decision time", async () => {
    const manifest = await readLifecycle(repositoryRoot);

    const errors = validatePhaseSequence(
      [
        approval("0", "2026-01-05T10:00:00Z"),
        approval("1", "2026-01-02T10:00:00Z"),
      ],
      manifest,
    );

    expect(messages(errors)).toContain(
      "Phase 1 was approved at 2026-01-02T10:00:00Z, before phase 0 was approved at 2026-01-05T10:00:00Z",
    );
  });

  it("fails closed when an optional phase prerequisite has no catalogued record", async () => {
    const manifest = await readLifecycle(repositoryRoot);

    const errors = validatePhaseSequence(
      [
        approval("6", "2026-01-06T10:00:00Z"),
        journalEvent("7", "PHASE-ENTERED", 9),
      ],
      manifest,
    );

    expect(messages(errors)).toContain(
      'declared prerequisite "scoped-attempt-authorisation" has no catalogued case record',
    );
  });

  it("still requires an approved Phase 6 before Phase 7 is entered", async () => {
    const manifest = await readLifecycle(repositoryRoot);

    const errors = validatePhaseSequence(
      [journalEvent("7", "PHASE-ENTERED", 9)],
      manifest,
    );

    expect(messages(errors)).toContain(
      "Phase 7 was entered while phase 6 has no approved human decision",
    );
  });

  it("ignores phases with no case evidence", async () => {
    const manifest = await readLifecycle(repositoryRoot);

    expect(validatePhaseSequence([], manifest)).toEqual([]);
  });
});
