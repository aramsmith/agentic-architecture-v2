import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createSchemaRegistry } from "../src/schema/validator.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredRecordTypes = [
  "architecture-catalogue",
  "azure-design-catalogue",
  "claim-catalogue",
  "deployment-attempts",
  "human-approval",
  "implementation-catalogue",
  "input-inventory",
  "interview-decisions",
  "lifecycle-manifest",
  "model-plan",
  "regulatory-coverage",
  "release-manifest",
  "requirements-catalogue",
  "review-record",
  "run-journal-event",
  "test-catalogue",
];

describe("schema catalogue", () => {
  it("compiles one versioned Draft 2020-12 schema for every promised record", async () => {
    const registry = await createSchemaRegistry(repositoryRoot);

    expect(registry.errors).toEqual([]);
    expect([...registry.validators.keys()].sort()).toEqual(requiredRecordTypes);
  });
});
