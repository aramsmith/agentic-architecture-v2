import { mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runDoctorCli } from "../src/doctor/cli.js";
import { diagnoseSetup, formatDoctorReport } from "../src/doctor/index.js";
import { validateFramework } from "../src/framework/index.js";
import { createIdentity } from "../src/identity/keys.js";

vi.mock("../src/framework/index.js", () => ({ validateFramework: vi.fn() }));
const directories: string[] = [];
async function home(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "aff-doctor-"));
  directories.push(directory);
  return directory;
}
beforeEach(() => { vi.mocked(validateFramework).mockResolvedValue({ errors: [] }); });
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("setup diagnostics", () => {
  it("reports a missing identity and unsupported Node without claiming host readiness", async () => {
    const report = await diagnoseSetup({ repositoryRoot: ".", home: await home(), nodeVersion: "20.19.0" });
    expect(report.readiness).toBe("blocked");
    expect(report.checks.filter(({ status }) => status === "missing").map(({ id }) => id)).toEqual(["node", "identity"]);
    expect(report.checks.filter(({ status }) => status === "manual").map(({ id }) => id)).toEqual(["host-models", "phase-6-deckio", "phase-6-pdf"]);
  });
  it("verifies local existence without unlocking private keys or asserting full readiness", async () => {
    const directory = await home();
    await createIdentity({ label: "Test architect", passphrase: "test-only-passphrase", home: directory });
    const report = await diagnoseSetup({ repositoryRoot: ".", home: directory, nodeVersion: "22.0.0" });
    expect(report.readiness).toBe("manual-verification-required");
    expect(report.checks.find(({ id }) => id === "identity")?.status).toBe("verified");
    expect(JSON.stringify(report)).not.toContain("PRIVATE KEY");
    expect(JSON.stringify(report)).not.toContain("test-only-passphrase");
    expect(formatDoctorReport(report)).toContain("does not certify end-to-end readiness");
  });
  it("detects an absent private-key file", async () => {
    const directory = await home();
    const identity = await createIdentity({ label: "Test", passphrase: "test-only-passphrase", home: directory });
    await unlink(identity.privateKeyPath);
    const report = await diagnoseSetup({ repositoryRoot: ".", home: directory });
    expect(report.checks.find(({ id }) => id === "identity")?.status).toBe("missing");
  });
  it("preserves framework failure details", async () => {
    const errors = [{ file: "profile.md", invariant: "profile", message: "Missing owner", remediation: "Declare owner" }];
    vi.mocked(validateFramework).mockResolvedValue({ errors });
    const report = await diagnoseSetup({ repositoryRoot: ".", home: await home() });
    expect(report.checks.find(({ id }) => id === "framework")).toMatchObject({ status: "missing", errors });
  });
  it("turns unreadable framework failures into a diagnostic", async () => {
    vi.mocked(validateFramework).mockRejectedValue(new Error("missing lifecycle"));
    const report = await diagnoseSetup({ repositoryRoot: ".", home: await home() });
    expect(report.checks.find(({ id }) => id === "framework")?.message).toContain("missing lifecycle");
  });
  it("prints valid JSON and returns a failing exit code for missing prerequisites", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runDoctorCli(["node", "doctor", "--json", "--home", await home()]);
    expect(result).toBe(1);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({ readiness: "blocked" });
  });
  it("prints plain diagnostics with a nonfailing local-check result but explicit manual checks", async () => {
    const directory = await home();
    await createIdentity({ label: "Test", passphrase: "test-only-passphrase", home: directory });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await runDoctorCli(["node", "doctor", "--home", directory])).toBe(0);
    expect(log.mock.calls[0]?.[0]).toContain("[manual] host-models");
  });
});
