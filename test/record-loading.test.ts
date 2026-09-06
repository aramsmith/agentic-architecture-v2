import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { loadCaseRecords } from "../src/case/records.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directories: string[] = [];
async function fixture(files: Record<string, string | Buffer>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "aff-loading-"));
  directories.push(root);
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  return root;
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("case record discovery", () => {
  it("allows application JSON and copied source evidence without AFF fields", async () => {
    const root = await fixture({
      "5-coding/app/package.json": '{"name":"example"}',
      "5-coding/app/tsconfig.json": '{"compilerOptions":{}}',
      "5-coding/app/data.jsonl": '{"recordType":"customer","id":1}\n',
      "0-coordination/input/source.json": '{"recordType":"human-approval","original":true}',
      "0-coordination/input/source.jsonl": '{"recordType":"review-record","original":true}\n',
    });
    expect(await loadCaseRecords(repositoryRoot, root)).toEqual({ records: [], errors: [] });
  });

  it("still enforces contracted records and detects misplaced AFF records", async () => {
    const review = await readFile(path.join(repositoryRoot, "test/fixtures/cases/valid-case/reviews/aff-a/0/round-1/sample-aff-a-review.json"), "utf8");
    const root = await fixture({
      "0-coordination/sample-model-plan.json": '{"assignments":[]}',
      "5-coding/app/misplaced-review.json": review,
    });
    const loaded = await loadCaseRecords(repositoryRoot, root);
    expect(loaded.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: "0-coordination/sample-model-plan.json", invariant: "schema-validation" }),
      expect.objectContaining({ file: "5-coding/app/misplaced-review.json", invariant: "record-location" }),
    ]));
  });

  it("reports malformed journal lines and other file failures together", async () => {
    const journal = await readFile(path.join(repositoryRoot, "test/fixtures/cases/valid-case/sample-run-journal.jsonl"), "utf8");
    const root = await fixture({
      "sample-run-journal.jsonl": `${journal.trim()}\n{broken\n`,
      "0-coordination/sample-model-plan.json": "{}",
    });
    const loaded = await loadCaseRecords(repositoryRoot, root);
    expect(loaded.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: `sample-run-journal.jsonl:${journal.trim().split("\n").length + 1}`, invariant: "json-syntax" }),
      expect.objectContaining({ file: "0-coordination/sample-model-plan.json", invariant: "schema-validation" }),
    ]));
    expect(loaded.records).toEqual([]);
  });

  it.each(["sample-run-journal.jsonl", "0-coordination/sample-model-plan.json"])("reports malformed UTF-8 in %s", async (file) => {
    const root = await fixture({ [file]: Buffer.from([0xff]) });
    const loaded = await loadCaseRecords(repositoryRoot, root);
    expect(loaded.errors).toEqual([expect.objectContaining({ file, invariant: "json-syntax" })]);
  });
});
