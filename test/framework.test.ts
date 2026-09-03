import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { validateFramework } from "../src/index.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories: string[] = [];

async function copyFramework(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "aff-framework-"));
  temporaryDirectories.push(root);
  await cp(path.join(repositoryRoot, ".github"), path.join(root, ".github"), {
    recursive: true,
  });
  await cp(path.join(repositoryRoot, "README.md"), path.join(root, "README.md"));
  await cp(path.join(repositoryRoot, "docs"), path.join(root, "docs"), {
    recursive: true,
  });
  await cp(path.join(repositoryRoot, "cases"), path.join(root, "cases"), {
    recursive: true,
  });
  try {
    await cp(path.join(repositoryRoot, "schemas"), path.join(root, "schemas"), {
      recursive: true,
    });
  } catch (error: unknown) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
  return root;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("framework validation", () => {
  it("accepts the packaged AFF framework", async () => {
    const result = await validateFramework(repositoryRoot);

    expect(result.errors).toEqual([]);
  });

  it("rejects an AFF-A model that matches a phase owner", async () => {
    const root = await copyFramework();
    const lifecyclePath = path.join(root, ".github", "agents", "AFF-LIFECYCLE.json");
    const lifecycle = await readFile(lifecyclePath, "utf8");
    await writeFile(
      lifecyclePath,
      lifecycle.replace('"model": "gpt-5.4"', '"model": "gpt-5.6-sol"'),
    );

    const result = await validateFramework(root);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: ".github/agents/AFF-LIFECYCLE.json",
        invariant: "reviewer-model-separation",
      }),
    );
  });

  it("rejects lifecycle and profile model drift", async () => {
    const root = await copyFramework();
    const profilePath = path.join(
      root,
      ".github",
      "agents",
      "AFF-1-requirements.agent.md",
    );
    const profile = await readFile(profilePath, "utf8");
    await writeFile(
      profilePath,
      profile.replace("model: gpt-5.6-sol", "model: gpt-5.4"),
    );

    const result = await validateFramework(root);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: ".github/agents/AFF-1-requirements.agent.md",
        invariant: "lifecycle-profile-consistency",
      }),
    );
  });

  it("rejects unsupported profile locations and duplicate names", async () => {
    const root = await copyFramework();
    await writeFile(
      path.join(root, ".github", "agents", "legacy-profile.md"),
      [
        "---",
        "name: AFF-1-requirements",
        'description: "Legacy duplicate"',
        "model: gpt-5.6-sol",
        "tools: [read]",
        "user-invocable: true",
        "disable-model-invocation: false",
        "---",
        "",
      ].join("\n"),
    );

    const result = await validateFramework(root);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: ".github/agents/legacy-profile.md",
          invariant: "supported-profile-location",
        }),
        expect.objectContaining({
          invariant: "unique-profile-name",
        }),
      ]),
    );
  });

  it("rejects stale root paths and unresolved concrete references", async () => {
    const root = await copyFramework();
    const profilePath = path.join(
      root,
      ".github",
      "agents",
      "AFF-1-requirements.agent.md",
    );
    const profile = await readFile(profilePath, "utf8");
    await writeFile(
      profilePath,
      profile
        .replace(
          ".github/skills/grill-me/SKILL.md",
          "skills/grill-me/SKILL.md",
        )
        .replace(
          ".github/agents/AFF-OPERATING-CONTRACT.md",
          ".github/agents/MISSING-CONTRACT.md",
        ),
    );

    const result = await validateFramework(root);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: ".github/agents/AFF-1-requirements.agent.md",
          invariant: "stale-root-reference",
        }),
        expect.objectContaining({
          file: ".github/agents/AFF-1-requirements.agent.md",
          invariant: "internal-reference-resolution",
        }),
      ]),
    );
  });

  it("rejects an unsupported lifecycle schema version", async () => {
    const root = await copyFramework();
    const lifecyclePath = path.join(root, ".github", "agents", "AFF-LIFECYCLE.json");
    const lifecycle = await readFile(lifecyclePath, "utf8");
    await writeFile(
      lifecyclePath,
      lifecycle.replace('"schemaVersion": "1.0.0"', '"schemaVersion": "9.0.0"'),
    );

    const result = await validateFramework(root);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: ".github/agents/AFF-LIFECYCLE.json",
        invariant: "schema-validation",
      }),
    );
  });

  it("rejects lifecycle route drift", async () => {
    const root = await copyFramework();
    const lifecyclePath = path.join(root, ".github", "agents", "AFF-LIFECYCLE.json");
    const lifecycle = await readFile(lifecyclePath, "utf8");
    await writeFile(
      lifecyclePath,
      lifecycle.replace('"next": "2"', '"next": "3"'),
    );

    const result = await validateFramework(root);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: ".github/agents/AFF-LIFECYCLE.json",
        invariant: "lifecycle-route-consistency",
      }),
    );
  });

  it("reports malformed frontmatter and unsupported skill filenames", async () => {
    const root = await copyFramework();
    const profilePath = path.join(
      root,
      ".github",
      "agents",
      "AFF-2-togafarchitecture.agent.md",
    );
    const profile = await readFile(profilePath, "utf8");
    await writeFile(
      profilePath,
      profile.replace('description: "', 'description: ["'),
    );
    const unsupportedSkill = path.join(
      root,
      ".github",
      "skills",
      "legacy",
      "skill.md",
    );
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.dirname(unsupportedSkill), { recursive: true });
    await writeFile(
      unsupportedSkill,
      "---\nname: legacy\ndescription: Legacy location\n---\n",
    );

    const result = await validateFramework(root);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: ".github/agents/AFF-2-togafarchitecture.agent.md",
          invariant: "profile-frontmatter",
        }),
        expect.objectContaining({
          file: ".github/skills/legacy/skill.md",
          invariant: "supported-profile-location",
        }),
      ]),
    );
  });

  it("reports malformed repository JSON inputs", async () => {
    const root = await copyFramework();
    const inputPath = path.join(
      root,
      "cases",
      "contoso-permit-services",
      "input",
      "phase-0-test-expectations.json",
    );
    await writeFile(inputPath, "{\n");

    const result = await validateFramework(root);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: "cases/contoso-permit-services/input/phase-0-test-expectations.json",
        invariant: "json-syntax",
      }),
    );
  });

  it("rejects schema catalogue coverage or stable ID drift", async () => {
    const root = await copyFramework();
    const schemaPath = path.join(
      root,
      "schemas",
      "aff",
      "1.0.0",
      "claim-catalogue.schema.json",
    );
    const schema = await readFile(schemaPath, "utf8");
    await writeFile(
      schemaPath,
      schema.replace(
        "https://github.com/aramsmith/agentic-architecture-v2/schemas/aff/1.0.0/claim-catalogue.schema.json",
        "https://example.invalid/claim-catalogue.schema.json",
      ),
    );

    const result = await validateFramework(root);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: "schemas/aff/1.0.0/claim-catalogue.schema.json",
        invariant: "schema-catalogue",
      }),
    );
  });

  it("rejects weakened lifecycle execution controls", async () => {
    const root = await copyFramework();
    const lifecyclePath = path.join(root, ".github", "agents", "AFF-LIFECYCLE.json");
    const lifecycle = await readFile(lifecyclePath, "utf8");
    await writeFile(
      lifecyclePath,
      lifecycle.replace(
        '"githubOidcAllowed": false',
        '"githubOidcAllowed": true',
      ),
    );

    const result = await validateFramework(root);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: ".github/agents/AFF-LIFECYCLE.json",
        invariant: "lifecycle-execution-policy",
      }),
    );
  });
});
