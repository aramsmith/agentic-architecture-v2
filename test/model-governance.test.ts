import { generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { hashArtifactBytes } from "../src/case/hash.js";
import { validateModelPlans } from "../src/case/models.js";
import type { LoadedRecord } from "../src/case/records.js";
import { readLifecycle } from "../src/framework/lifecycle.js";
import { signApproval } from "../src/identity/signature.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function record(file: string, value: Record<string, unknown>): LoadedRecord {
  return { file, absolutePath: path.join(repositoryRoot, file), value,
    snapshotSha256: hashArtifactBytes(file, Buffer.from(JSON.stringify(value))) };
}
async function plan() {
  const value = JSON.parse(await readFile(path.join(repositoryRoot, "test/fixtures/cases/valid-case/0-coordination/sample-model-plan.json"), "utf8")) as Record<string, unknown> & {
    assignments: { agent: string; model: string; available: boolean; approvalReference?: string }[];
  };
  return { value, loaded: record("0-coordination/sample-model-plan.json", value), lifecycle: await readLifecycle(repositoryRoot) };
}
function signedDecision(agent: string, fromModel: string, toModel: string, extra: Record<string, unknown> = {}) {
  const keys = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase: "test-only-passphrase" },
  });
  return record("approvals/phase-0/prior.json", signApproval({
    recordType: "human-approval", decision: "APPROVED", artifactHashes: [],
    extensions: { modelSubstitutions: [{ agent, fromModel, toModel }] }, ...extra,
  }, keys.privateKey, "test-only-passphrase", keys.publicKey));
}

describe("model governance", () => {
  it("accepts available lifecycle assignments", async () => {
    const { loaded, lifecycle } = await plan();
    expect(validateModelPlans([loaded], lifecycle)).toEqual([]);
  });
  it("rejects unavailable assignments", async () => {
    const { value, loaded, lifecycle } = await plan();
    value.assignments[0]!.available = false;
    expect(validateModelPlans([loaded], lifecycle)).toEqual(expect.arrayContaining([
      expect.objectContaining({ invariant: "model-plan-consistency", message: expect.stringContaining("unavailable") }),
    ]));
  });
  it("rejects a fabricated substitution reference", async () => {
    const { value, loaded, lifecycle } = await plan();
    value.assignments[0]!.model = "gpt-substitute";
    value.assignments[0]!.approvalReference = "human said yes";
    expect(validateModelPlans([loaded], lifecycle).some(({ message }) => message.includes("hash-bound"))).toBe(true);
  });
  it.each(["valid", "historical-plan", "wrong-hash", "wrong-model", "unsigned", "rejected", "circular"])("validates %s substitution evidence", async (scenario) => {
    const { value, loaded, lifecycle } = await plan();
    const assignment = value.assignments[0]!;
    const fromModel = assignment.model;
    assignment.model = "gpt-substitute";
    const approval = signedDecision(assignment.agent, fromModel, scenario === "wrong-model" ? "gpt-other" : assignment.model,
      scenario === "rejected" ? { decision: "REJECTED" } : scenario === "circular" || scenario === "historical-plan" ? { artifactHashes: [{ path: loaded.file, sha256: scenario === "circular" ? loaded.snapshotSha256 : "e".repeat(64) }] } : {});
    if (scenario === "unsigned") delete (approval.value.extensions as Record<string, unknown>).signature;
    assignment.approvalReference = approval.file;
    value.extensions = { modelSubstitutionApprovals: [{ path: approval.file, sha256: scenario === "wrong-hash" ? "0".repeat(64) : approval.snapshotSha256 }] };
    const errors = validateModelPlans([loaded, approval], lifecycle);
    expect(errors.some(({ message }) => message.includes("hash-bound"))).toBe(scenario !== "valid" && scenario !== "historical-plan");
  });
});
