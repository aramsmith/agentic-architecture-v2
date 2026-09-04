import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  approvalModeLabel,
  isApprovalMode,
  resolveApprovalMode,
  validateApprovalModes,
} from "../src/case/approval-mode.js";
import type { LoadedRecord } from "../src/case/records.js";
import { asApproval, type Approval } from "../src/case/review-records.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const binding = [
  { path: "0-coordination/sample-coordination.md", sha256: "a".repeat(64) },
];

function approvalRecord(extensions?: Record<string, unknown>): LoadedRecord {
  return {
    file: "approvals/phase-0/sample-approval.json",
    absolutePath: path.join(repositoryRoot, "approvals", "sample.json"),
    snapshotSha256: "b".repeat(64),
    value: {
      schemaVersion: "1.0.0",
      recordType: "human-approval",
      caseName: "sample",
      artifactPrefix: "sample",
      phaseId: "0",
      artifactHashes: binding,
      reviewRecords: binding,
      decision: "APPROVED",
      approver: "Accountable architect",
      decidedAt: "2026-01-01T10:00:00Z",
      ...(extensions ? { extensions } : {}),
    },
  };
}

function toApproval(record: LoadedRecord): Approval {
  const approval = asApproval(record);
  if (!approval) {
    throw new Error("fixture is not a valid approval record");
  }
  return approval;
}

describe("approval assurance mode", () => {
  it("resolves an ordinary approval as self-asserted", () => {
    expect(resolveApprovalMode(toApproval(approvalRecord()))).toBe(
      "self-asserted",
    );
  });

  it("resolves harness-generated evidence as synthetic", () => {
    const approval = toApproval(
      approvalRecord({ syntheticTestEvidence: true, realApproval: false }),
    );

    expect(resolveApprovalMode(approval)).toBe("synthetic");
  });

  it("never resolves to human-verified while no signature is supported", () => {
    const approval = toApproval(
      approvalRecord({ approvalMode: "human-verified" }),
    );

    expect(resolveApprovalMode(approval)).not.toBe("human-verified");
  });

  it("accepts a declared mode that matches the recorded evidence", () => {
    expect(
      validateApprovalModes([
        approvalRecord({ approvalMode: "self-asserted" }),
        approvalRecord({
          approvalMode: "synthetic",
          syntheticTestEvidence: true,
          realApproval: false,
        }),
      ]),
    ).toEqual([]);
  });

  it("rejects an approval that claims verification it cannot show", () => {
    const errors = validateApprovalModes([
      approvalRecord({ approvalMode: "human-verified" }),
    ]);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual(
      expect.objectContaining({ invariant: "approval-mode" }),
    );
    expect(errors[0]?.message).toContain(
      'declares assurance mode "human-verified" but its recorded evidence supports only "self-asserted"',
    );
  });

  it("rejects synthetic evidence that presents itself as a human decision", () => {
    const errors = validateApprovalModes([
      approvalRecord({
        approvalMode: "self-asserted",
        syntheticTestEvidence: true,
        realApproval: false,
      }),
    ]);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain('supports only "synthetic"');
  });

  it("rejects an unknown assurance mode", () => {
    const errors = validateApprovalModes([
      approvalRecord({ approvalMode: "board-approved" }),
    ]);

    expect(errors).toEqual([
      expect.objectContaining({ invariant: "approval-mode" }),
    ]);
    expect(errors[0]?.message).toContain("unknown assurance mode");
  });

  it("treats an absent declaration as the weakest claim rather than an error", () => {
    expect(validateApprovalModes([approvalRecord()])).toEqual([]);
  });

  it("describes each mode without overstating it", () => {
    expect(approvalModeLabel("self-asserted")).toContain(
      "without verification of the approver",
    );
    expect(approvalModeLabel("synthetic")).toContain("no human decision");
    expect(isApprovalMode("human-verified")).toBe(true);
    expect(isApprovalMode("rubber-stamped")).toBe(false);
  });
});
