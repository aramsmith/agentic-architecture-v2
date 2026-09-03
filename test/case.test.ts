import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { validateCase } from "../src/index.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories: string[] = [];

async function copyValidCase(): Promise<{
  root: string;
  caseRoot: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "aff-case-"));
  const caseRoot = path.join(root, "cases", "valid-case");
  temporaryDirectories.push(root);
  await cp(path.join(repositoryRoot, "schemas"), path.join(root, "schemas"), {
    recursive: true,
  });
  await cp(
    path.join(repositoryRoot, ".github", "agents", "AFF-LIFECYCLE.json"),
    path.join(root, ".github", "agents", "AFF-LIFECYCLE.json"),
  );
  await cp(
    path.join(repositoryRoot, "test", "fixtures", "cases", "valid-case"),
    caseRoot,
    { recursive: true },
  );
  return { root, caseRoot };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("case validation", () => {
  it("rejects a case path that escapes the cases directory", async () => {
    const result = await validateCase(repositoryRoot, "..\\outside-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        invariant: "case-path-containment",
      }),
    );
  });

  it("rejects an absolute case path even when it points beneath cases", async () => {
    const { root } = await copyValidCase();

    const result = await validateCase(
      root,
      path.join(root, "cases", "valid-case"),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        invariant: "case-path-containment",
      }),
    );
  });

  it("rejects parent traversal even when normalization returns to the same case", async () => {
    const { root } = await copyValidCase();

    const result = await validateCase(
      root,
      "cases/valid-case/../valid-case",
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        invariant: "case-path-containment",
      }),
    );
  });

  it("accepts a case with schema-valid records and current hash bindings", async () => {
    const { root } = await copyValidCase();

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toEqual([]);
  });

  it("treats arbitrary input JSON as syntax-only source material", async () => {
    const { root, caseRoot } = await copyValidCase();
    await writeFile(
      path.join(caseRoot, "input", "source-record.json"),
      '{"recordType":"customer-source-record","value":1}\n',
    );
    await writeFile(
      path.join(caseRoot, "input", "source-events.jsonl"),
      '{"recordType":"customer-event","value":1}\n',
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toEqual([]);
  });

  it("rejects a malformed record schema version", async () => {
    const { root, caseRoot } = await copyValidCase();
    const reviewPath = path.join(
      caseRoot,
      "reviews",
      "aff-a",
      "0",
      "round-1",
      "sample-aff-a-review.json",
    );
    await cp(
      path.join(
        repositoryRoot,
        "test",
        "fixtures",
        "invalid",
        "review-schema-version.json",
      ),
      reviewPath,
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        invariant: "schema-validation",
      }),
    );
  });

  it("rejects an artifact changed after final review", async () => {
    const { root, caseRoot } = await copyValidCase();
    await writeFile(
      path.join(caseRoot, "0-coordination", "sample-coordination.md"),
      "# Phase 0\n\nChanged after review.\n",
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        invariant: "artifact-hash-binding",
      }),
    );
  });

  it("rejects final reviewers that cover different artifact sets", async () => {
    const { root, caseRoot } = await copyValidCase();
    await writeFile(
      path.join(caseRoot, "0-coordination", "extra.md"),
      "# Phase 0\n\nApproved candidate.\n",
    );
    const reviewPath = path.join(
      caseRoot,
      "reviews",
      "aff-b",
      "0",
      "round-1",
      "sample-aff-b-review.json",
    );
    const review = await readFile(reviewPath, "utf8");
    await writeFile(
      reviewPath,
      review.replace(
        '"subjectArtifacts": [',
        '"subjectArtifacts": [\n    {\n      "path": "0-coordination/extra.md",\n      "sha256": "39c9048f4916f97c9517220dbe0b9b305e566811782856b083df44c99cc26d6c"\n    },',
      ),
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        invariant: "review-convergence",
      }),
    );
  });

  it("rejects duplicate final records for the same reviewer round", async () => {
    const { root, caseRoot } = await copyValidCase();
    await cp(
      path.join(
        caseRoot,
        "reviews",
        "aff-a",
        "0",
        "round-1",
        "sample-aff-a-review.json",
      ),
      path.join(
        caseRoot,
        "reviews",
        "aff-a",
        "0",
        "round-1",
        "duplicate-aff-a-review.json",
      ),
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        invariant: "review-convergence",
        message: expect.stringContaining("same reviewer, phase, and round"),
      }),
    );
  });

  it("rejects phase files omitted from the current journalled review set", async () => {
    const { root, caseRoot } = await copyValidCase();
    await writeFile(
      path.join(caseRoot, "0-coordination", "unreviewed-evidence.txt"),
      "Material evidence.\n",
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        invariant: "review-convergence",
        message: expect.stringContaining("unreviewed-evidence.txt"),
      }),
    );
  });

  it("rejects approval bound to stale artifact hashes", async () => {
    const { root, caseRoot } = await copyValidCase();
    await writeFile(
      path.join(caseRoot, "0-coordination", "extra.md"),
      "# Phase 0\n\nApproved candidate.\n",
    );
    const approvalPath = path.join(
      caseRoot,
      "approvals",
      "phase-0",
      "sample-phase-0-approval.json",
    );
    const approval = await readFile(approvalPath, "utf8");
    await writeFile(
      approvalPath,
      approval.replace(
        "0-coordination/sample-coordination.md",
        "0-coordination/extra.md",
      ),
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        invariant: "approval-binding",
      }),
    );
  });

  it("validates every JSONL event against its versioned schema", async () => {
    const { root, caseRoot } = await copyValidCase();
    const journalPath = path.join(caseRoot, "sample-run-journal.jsonl");
    const journal = await readFile(journalPath, "utf8");
    await writeFile(
      journalPath,
      journal.replace(
        '"schemaVersion":"1.0.0"',
        '"schemaVersion":"9.0.0"',
      ),
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: "sample-run-journal.jsonl:1",
        invariant: "schema-validation",
      }),
    );
  });

  it("rejects a case model plan that breaks AFF-A separation", async () => {
    const { root, caseRoot } = await copyValidCase();
    const modelPlanPath = path.join(
      caseRoot,
      "0-coordination",
      "sample-model-plan.json",
    );
    const modelPlan = await readFile(modelPlanPath, "utf8");
    await writeFile(
      modelPlanPath,
      modelPlan.replace('"model": "gpt-5.4"', '"model": "gpt-5.6-sol"'),
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: "0-coordination/sample-model-plan.json",
        invariant: "reviewer-model-separation",
      }),
    );
  });

  it("rejects a cyclic implementation dependency graph", async () => {
    const { root, caseRoot } = await copyValidCase();
    const cataloguePath = path.join(
      caseRoot,
      "4-implementation-plan",
      "sample-implementation-catalogue.json",
    );
    const catalogue = await readFile(cataloguePath, "utf8");
    await writeFile(
      cataloguePath,
      catalogue.replace('"dependsOn": []', '"dependsOn": ["unit-b"]'),
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: "4-implementation-plan/sample-implementation-catalogue.json",
        invariant: "implementation-dag",
      }),
    );
  });

  it("rejects non-monotonic run-journal sequences", async () => {
    const { root, caseRoot } = await copyValidCase();
    const journalPath = path.join(caseRoot, "sample-run-journal.jsonl");
    const journal = await readFile(journalPath, "utf8");
    await writeFile(journalPath, `${journal.trimEnd()}\n${journal.trimEnd()}\n`);

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: "sample-run-journal.jsonl:2",
        invariant: "run-journal-sequence",
      }),
    );
  });

  it("rejects forked run journals", async () => {
    const { root, caseRoot } = await copyValidCase();
    await cp(
      path.join(caseRoot, "sample-run-journal.jsonl"),
      path.join(caseRoot, "fork-run-journal.jsonl"),
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        invariant: "run-journal-sequence",
        message: expect.stringContaining("multiple AFF run journals"),
      }),
    );
  });

  it("rejects a final AFF-A review using a phase-owner model", async () => {
    const { root, caseRoot } = await copyValidCase();
    const reviewPath = path.join(
      caseRoot,
      "reviews",
      "aff-a",
      "0",
      "round-1",
      "sample-aff-a-review.json",
    );
    const review = await readFile(reviewPath, "utf8");
    await writeFile(
      reviewPath,
      review.replace('"model": "gpt-5.4"', '"model": "gpt-5.6-sol"'),
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: "reviews/aff-a/0/round-1/sample-aff-a-review.json",
        invariant: "reviewer-model-separation",
      }),
    );
  });

  it("keeps superseded reviews and approvals valid after an approved new round", async () => {
    const { root, caseRoot } = await copyValidCase();
    const deltaRoot = path.join(
      repositoryRoot,
      "test",
      "fixtures",
      "append-only",
    );
    await writeFile(
      path.join(caseRoot, "0-coordination", "sample-coordination.md"),
      "# Phase 0\n\nApproved candidate, revision two.\n",
    );
    await cp(
      path.join(deltaRoot, "sample-aff-a-review.json"),
      path.join(
        caseRoot,
        "reviews",
        "aff-a",
        "0",
        "round-2",
        "sample-aff-a-review.json",
      ),
    );
    await cp(
      path.join(deltaRoot, "sample-aff-b-review.json"),
      path.join(
        caseRoot,
        "reviews",
        "aff-b",
        "0",
        "round-2",
        "sample-aff-b-review.json",
      ),
    );
    await cp(
      path.join(deltaRoot, "sample-phase-0-approval.json"),
      path.join(
        caseRoot,
        "approvals",
        "phase-0",
        "sample-phase-0-approval-2.json",
      ),
    );
    const eventText = await readFile(
      path.join(deltaRoot, "journal-event.json"),
      "utf8",
    );
    const event: unknown = JSON.parse(eventText);
    const journalPath = path.join(caseRoot, "sample-run-journal.jsonl");
    const journal = await readFile(journalPath, "utf8");
    await writeFile(
      journalPath,
      `${journal.trimEnd()}\n${JSON.stringify(event)}\n`,
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toEqual([]);
  });

  it("invalidates the current approval when a newer review round is incomplete", async () => {
    const { root, caseRoot } = await copyValidCase();
    const sourceReview = path.join(
      caseRoot,
      "reviews",
      "aff-a",
      "0",
      "round-1",
      "sample-aff-a-review.json",
    );
    const review = await readFile(sourceReview, "utf8");
    const roundTwoReview = review
      .replace('"round": 1', '"round": 2')
      .replace('"final": true', '"final": false')
      .replace(
        '"reviewedAt": "2026-01-01T10:00:00Z"',
        '"reviewedAt": "2026-01-01T11:00:00Z"',
      );
    await mkdir(
      path.join(caseRoot, "reviews", "aff-a", "0", "round-2"),
      { recursive: true },
    );
    await writeFile(
      path.join(
        caseRoot,
        "reviews",
        "aff-a",
        "0",
        "round-2",
        "sample-aff-a-review.json",
      ),
      roundTwoReview,
    );

    const result = await validateCase(root, "cases/valid-case");

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        invariant: "approval-binding",
        message: expect.stringContaining("latest approval is stale"),
      }),
    );
  });
});
