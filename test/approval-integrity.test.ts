import { generateKeyPairSync, sign } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { prepareApproval, recordSignedDecision, type ApprovalContext } from "../src/approve/prepare.js";
import { hashArtifact } from "../src/case/hash.js";
import { validateCase } from "../src/case/index.js";
import { validateApprovalModes } from "../src/case/approval-mode.js";
import type { LoadedRecord } from "../src/case/records.js";
import { asApproval } from "../src/case/review-records.js";
import { loadCaseRecords } from "../src/case/records.js";
import { activeApproval } from "../src/case/state.js";
import { createIdentity, fingerprintPublicKey } from "../src/identity/keys.js";
import { signablePayload, verifyApprovalSignature } from "../src/identity/signature.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function caseFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "aff-integrity-case-")); roots.push(root);
  const caseRoot = path.join(root, "cases", "valid-case");
  await cp(path.join(process.cwd(), "schemas"), path.join(root, "schemas"), { recursive: true });
  await cp(path.join(process.cwd(), ".github/agents/AFF-LIFECYCLE.json"), path.join(root, ".github/agents/AFF-LIFECYCLE.json"));
  await cp(path.join(process.cwd(), "test/fixtures/cases/valid-case"), caseRoot, { recursive: true });
  const identity = await createIdentity({ home: root, label: "Test", passphrase: "temporary test passphrase" });
  // This fixture deliberately contains pre-identity unsigned history.
  await writeFile(identity.publicKeyPath, JSON.stringify({ label: "Test", publicKeyPem: identity.publicKeyPem, requireSignedApprovals: false }));
  return { root, caseRoot, options: { repositoryRoot: root, casePath: "cases/valid-case", phaseId: "0", home: root } };
}

function key() {
  const pair = generateKeyPairSync("ed25519");
  const pem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  return { ...pair, pem, fingerprint: fingerprintPublicKey(pem) };
}

function signedRecord(signer: ReturnType<typeof key>, day: number, extensions: Record<string, unknown> = {}): LoadedRecord {
  const value: Record<string, unknown> = {
    recordType: "human-approval", phaseId: "0", decision: "APPROVED", approver: "Test architect",
    decidedAt: `2026-01-${String(day).padStart(2, "0")}T10:00:00Z`, artifactHashes: [], reviewRecords: [],
    extensions: { approvalMode: "human-verified", ...extensions },
  };
  const signature = {
    algorithm: "ed25519", publicKeyPem: signer.pem, keyFingerprint: signer.fingerprint,
    value: sign(null, signablePayload(value), signer.privateKey).toString("base64"),
  };
  value.extensions = { ...(value.extensions as object), signature };
  return { value, file: `approvals/phase-0/${day}.json`, absolutePath: `/unused/${day}.json`, snapshotSha256: "" };
}

describe("approval integrity", () => {
  it("rejects decisions before final reviews and never activates them historically", async () => {
    const fixture = await caseFixture();
    const file = path.join(fixture.caseRoot, "approvals/phase-0/sample-phase-0-approval.json");
    const value = JSON.parse(await readFile(file, "utf8"));
    value.decidedAt = "2026-01-01T09:30:00Z";
    await writeFile(file, JSON.stringify(value));
    expect((await validateCase(fixture.root, "cases/valid-case", { home: fixture.root })).errors)
      .toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("precede either") })]));
    const loaded = await loadCaseRecords(fixture.root, fixture.caseRoot);
    expect(activeApproval(loaded.records, "0", Date.parse("2026-01-01T09:45:00Z"))).toBeUndefined();
    expect(activeApproval(loaded.records, "0")).toBeUndefined();
  });

  it("requires case context even for direct signing calls", async () => {
    const context = { verdicts: [], phaseId: "0", outputPath: "approvals/phase-0/decision.json" } as unknown as ApprovalContext;
    await expect(recordSignedDecision({ context, decision: "APPROVED", passphrase: "unused" }))
      .rejects.toThrow("complete case context");
  });

  it.each(["APPROVED", "REJECTED"] as const)("checks %s decision chronology before creating a file", async (decision) => {
    const fixture = await caseFixture();
    const context = await prepareApproval(fixture.options);
    await expect(recordSignedDecision({ context, decision, home: fixture.root,
      passphrase: "temporary test passphrase", decidedAt: "2026-01-01T09:30:00Z" }))
      .rejects.toThrow("precede either");
    await expect(readFile(path.join(fixture.caseRoot, context.outputPath))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects incomplete evidence supplied by direct callers with case context", async () => {
    const fixture = await caseFixture();
    const context = await prepareApproval(fixture.options);
    context.artifacts = [];
    context.reviewBindings = [];
    await expect(recordSignedDecision({ context, decision: "APPROVED", home: fixture.root,
      passphrase: "temporary test passphrase" })).rejects.toThrow("evidence or identity changed");
    await expect(readFile(path.join(fixture.caseRoot, context.outputPath))).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("derives continuity from the verified key even when the optional outer fingerprint is absent", () => {
    const first = key();
    const other = key();
    const a = signedRecord(first, 1);
    const b = signedRecord(other, 2);
    expect(asApproval(a)?.keyFingerprint).toBe(first.fingerprint);
    expect(validateApprovalModes([a, b])).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringContaining("case is anchored") }),
    ]));
  });

  it("rejects a valid alternate-key signature that claims the original fingerprint", () => {
    const a = key();
    const b = signedRecord(key(), 2, { keyFingerprint: a.fingerprint });
    expect(verifyApprovalSignature(b.value).verified).toBe(false);
    expect(validateApprovalModes([signedRecord(a, 1), b]).length).toBeGreaterThan(0);
  });

  it("advances the active key through rotations and rejects the former key", () => {
    const a = key(); const b = key(); const c = key();
    const records = [signedRecord(a, 1), signedRecord(b, 2, {
      keyRotation: { previousKeyFingerprint: a.fingerprint, reason: "Key replaced" },
    }), signedRecord(b, 3), signedRecord(c, 4, {
      keyRotation: { previousKeyFingerprint: b.fingerprint, reason: "Second replacement" },
    }), signedRecord(c, 5)];
    expect(validateApprovalModes(records)).toEqual([]);
    expect(validateApprovalModes([...records, signedRecord(a, 6)]).length).toBeGreaterThan(0);
  });

  it.each([
    { previousKeyFingerprint: "wrong", reason: "Replacement" },
    { previousKeyFingerprint: "active", reason: " " },
  ])("rejects invalid rotation metadata %j", (rotation) => {
    const a = key();
    const metadata = { ...rotation, previousKeyFingerprint: rotation.previousKeyFingerprint === "active" ? a.fingerprint : rotation.previousKeyFingerprint };
    expect(validateApprovalModes([signedRecord(a, 1), signedRecord(key(), 2, { keyRotation: metadata })]).length).toBeGreaterThan(0);
  });

  it("returns a validation failure for an incompatible public key instead of throwing", () => {
    const record = signedRecord(key(), 1);
    const incompatible = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ type: "spki", format: "pem" }).toString();
    const extensions = record.value.extensions as { signature: Record<string, unknown> };
    extensions.signature.publicKeyPem = incompatible;
    extensions.signature.keyFingerprint = fingerprintPublicKey(incompatible);
    expect(verifyApprovalSignature(record.value)).toEqual({ verified: false, reason: "the embedded public key is not Ed25519" });
  });

  it("never silently downgrades a malformed signature", () => {
    const record = signedRecord(key(), 1);
    const extensions = record.value.extensions as Record<string, unknown>;
    delete extensions.approvalMode;
    extensions.signature = {};
    expect(validateApprovalModes([record])).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringContaining("signature is invalid") }),
    ]));
  });

  it("rejects garbage appended to otherwise valid base64", () => {
    const record = signedRecord(key(), 1);
    const extensions = record.value.extensions as { signature: { value: string } };
    extensions.signature.value += "!";
    expect(verifyApprovalSignature(record.value).verified).toBe(false);
  });

  it("uses exclusive decision creation and preserves the previous bytes", async () => {
    const fixture = await caseFixture();
    const home = fixture.root;
    const passphrase = "temporary test passphrase";
    const context = await prepareApproval(fixture.options);
    await recordSignedDecision({ context, decision: "APPROVED", passphrase, home, decidedAt: "2026-01-01T11:00:00Z" });
    const file = path.join(fixture.caseRoot, context.outputPath);
    const original = await readFile(file, "utf8");
    await expect(recordSignedDecision({ context, decision: "REJECTED", passphrase, home, decidedAt: "2026-01-02T10:00:00Z" })).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(file, "utf8")).toBe(original);
  });

  it("refuses to approve a DIVERGES verdict before accessing a human key", async () => {
    const context = { verdicts: [{ reviewer: "AFF-A", verdict: "DIVERGES", round: 1 }] } as ApprovalContext;
    await expect(recordSignedDecision({ context, decision: "APPROVED", passphrase: "unused" })).rejects.toThrow("cannot override a DIVERGES");
  });

  it("prepares unique decisions and rechecks evidence before signing", async () => {
    const fixture = await caseFixture();
    const first = await prepareApproval(fixture.options);
    const second = await prepareApproval(fixture.options);
    expect(first.outputPath).not.toBe(second.outputPath);
    const markdown = path.join(fixture.caseRoot, "0-coordination/sample-coordination.md");
    await writeFile(markdown, `${await readFile(markdown, "utf8")}\nChanged while deciding.\n`);
    await expect(recordSignedDecision({ context: first, decision: "APPROVED", passphrase: "temporary test passphrase", home: fixture.root })).rejects.toThrow("does not currently validate");
  });

  it("does not suppress a damaged historical signature while preparing a replacement", async () => {
    const fixture = await caseFixture();
    const file = path.join(fixture.caseRoot, "approvals/phase-0/sample-phase-0-approval.json");
    const record = JSON.parse(await readFile(file, "utf8"));
    record.extensions = { signature: {} };
    await writeFile(file, JSON.stringify(record));
    await expect(prepareApproval(fixture.options)).rejects.toThrow("approval-mode");
  });

  it("reapproves new candidate and review rounds while preserving the original decision", async () => {
    const fixture = await caseFixture();
    const oldFile = path.join(fixture.caseRoot, "approvals/phase-0/sample-phase-0-approval.json");
    const original = await readFile(oldFile, "utf8");
    const artifact = "0-coordination/sample-coordination.md";
    const markdown = path.join(fixture.caseRoot, artifact);
    await writeFile(markdown, `${await readFile(markdown, "utf8")}\nNew reviewed content.\n`);
    const newHash = await hashArtifact(markdown);
    for (const reviewer of ["aff-a", "aff-b"]) {
      const oldReview = path.join(fixture.caseRoot, `reviews/${reviewer}/0/round-1/sample-${reviewer}-review.json`);
      const review = JSON.parse(await readFile(oldReview, "utf8"));
      review.round = 2;
      review.reviewedAt = "2026-01-01T11:00:00Z";
      review.subjectArtifacts.find((binding: { path: string }) => binding.path === artifact).sha256 = newHash;
      const nextReview = oldReview.replace("round-1", "round-2");
      await mkdir(path.dirname(nextReview), { recursive: true });
      await writeFile(nextReview, JSON.stringify(review));
    }
    const journal = path.join(fixture.caseRoot, "sample-run-journal.jsonl");
    const history = await readFile(journal, "utf8");
    const event = JSON.parse(history.trim());
    event.sequence = 2; event.eventId = "EVT-002"; event.timestamp = "2026-01-01T10:30:00Z";
    event.artifactHashes.find((binding: { path: string }) => binding.path === artifact).sha256 = newHash;
    await writeFile(journal, `${history.trim()}\n${JSON.stringify(event)}\n`);
    const context = await prepareApproval(fixture.options);
    await recordSignedDecision({ context, decision: "APPROVED", passphrase: "temporary test passphrase", home: fixture.root, decidedAt: "2026-01-01T12:00:00Z" });
    expect(await readFile(oldFile, "utf8")).toBe(original);
    expect((await validateCase(fixture.root, "cases/valid-case", { home: fixture.root })).errors).toEqual([]);
  });
});
