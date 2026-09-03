import { readFile } from "node:fs/promises";
import path from "node:path";

import Ajv2020, {
  type AnySchemaObject,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { isRecord } from "../common/json.js";
import type { ValidationError } from "../types.js";
import {
  readSchemaCatalogue,
  type SchemaCatalogue,
  type SchemaCatalogueEntry,
} from "./catalogue.js";

export interface SchemaRegistry {
  catalogue: SchemaCatalogue;
  entries: Map<string, SchemaCatalogueEntry>;
  validators: Map<string, ValidateFunction>;
  errors: ValidationError[];
}

const requiredRecordTypes = new Set([
  "lifecycle-manifest",
  "input-inventory",
  "model-plan",
  "interview-decisions",
  "requirements-catalogue",
  "architecture-catalogue",
  "azure-design-catalogue",
  "implementation-catalogue",
  "release-manifest",
  "claim-catalogue",
  "deployment-attempts",
  "test-catalogue",
  "review-record",
  "human-approval",
  "regulatory-coverage",
  "run-journal-event",
]);

function parseSchema(content: string, file: string): AnySchemaObject {
  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError(`${file} must contain a JSON Schema object.`);
  }

  // Ajv validates the complete schema during addSchema/compile; this narrows its JSON input boundary.
  return parsed as AnySchemaObject;
}

function schemaError(
  file: string,
  recordType: string,
  error: ErrorObject,
): ValidationError {
  const location = error.instancePath || "/";
  return {
    file,
    invariant: "schema-validation",
    message: `${recordType} ${location}: ${error.message ?? "is invalid"}.`,
    remediation:
      "Correct the record to match its catalogued JSON Schema and schemaVersion.",
  };
}

export async function createSchemaRegistry(
  repositoryRoot: string,
): Promise<SchemaRegistry> {
  const catalogue = await readSchemaCatalogue(repositoryRoot);
  const errors: ValidationError[] = [];
  if (
    catalogue.jsonSchemaDraft !==
    "https://json-schema.org/draft/2020-12/schema"
  ) {
    errors.push({
      file: "schemas/aff/catalogue.json",
      invariant: "schema-catalogue",
      message: `Unsupported JSON Schema draft "${catalogue.jsonSchemaDraft}".`,
      remediation: "Use JSON Schema Draft 2020-12 for AFF contracts.",
    });
  }
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
  });
  addFormats(ajv);

  const schemaRoot = path.join(repositoryRoot, "schemas", "aff");
  const sharedPath = path.join(
    schemaRoot,
    catalogue.contractVersion,
    "shared.schema.json",
  );
  const shared = parseSchema(
    await readFile(sharedPath, "utf8"),
    sharedPath,
  );
  const expectedSharedId = `https://github.com/aramsmith/agentic-architecture-v2/schemas/aff/${catalogue.contractVersion}/shared.schema.json`;
  if (shared.$id !== expectedSharedId) {
    errors.push({
      file: `schemas/aff/${catalogue.contractVersion}/shared.schema.json`,
      invariant: "schema-catalogue",
      message: "Shared schema $id does not match its stable repository URL.",
      remediation: `Set $id to "${expectedSharedId}".`,
    });
  }
  ajv.addSchema(shared, expectedSharedId);

  const entries = new Map<string, SchemaCatalogueEntry>();
  const validators = new Map<string, ValidateFunction>();
  for (const entry of catalogue.schemas) {
    if (entries.has(entry.recordType)) {
      errors.push({
        file: "schemas/aff/catalogue.json",
        invariant: "schema-catalogue",
        message: `Schema catalogue repeats recordType "${entry.recordType}".`,
        remediation: "Keep exactly one schema entry for each recordType.",
      });
      continue;
    }
    if (
      !entry.file.startsWith(`${catalogue.contractVersion}/`) ||
      entry.file.includes("..") ||
      path.isAbsolute(entry.file)
    ) {
      errors.push({
        file: "schemas/aff/catalogue.json",
        invariant: "schema-catalogue",
        message: `Schema file "${entry.file}" is outside the active version directory.`,
        remediation: `Store it beneath schemas/aff/${catalogue.contractVersion}/.`,
      });
      continue;
    }
    const schemaPath = path.join(schemaRoot, entry.file);
    const schema = parseSchema(
      await readFile(schemaPath, "utf8"),
      schemaPath,
    );
    entries.set(entry.recordType, entry);
    const schemaFile = `schemas/aff/${entry.file}`;
    const expectedId = `https://github.com/aramsmith/agentic-architecture-v2/schemas/aff/${entry.file}`;
    if (schema.$id !== expectedId) {
      errors.push({
        file: schemaFile,
        invariant: "schema-catalogue",
        message: `Schema $id "${String(schema.$id)}" does not match its stable catalogue URL.`,
        remediation: `Set $id to "${expectedId}".`,
      });
      continue;
    }
    if (
      !isRecord(schema.properties) ||
      !isRecord(schema.properties.schemaVersion)
    ) {
      errors.push({
        file: schemaFile,
        invariant: "schema-catalogue",
        message: "Record schema does not declare the required schemaVersion field.",
        remediation:
          "Reference shared.schema.json#/$defs/schemaVersion from properties.schemaVersion.",
      });
      continue;
    }
    validators.set(entry.recordType, ajv.compile(schema));
  }

  for (const recordType of requiredRecordTypes) {
    if (!entries.has(recordType)) {
      errors.push({
        file: "schemas/aff/catalogue.json",
        invariant: "schema-catalogue",
        message: `Required AFF record type "${recordType}" has no catalogue entry.`,
        remediation:
          "Add a versioned Draft 2020-12 schema and catalogue mapping for the record.",
      });
    }
  }

  return { catalogue, entries, validators, errors };
}

export function validateRecordSchema(
  registry: SchemaRegistry,
  file: string,
  record: unknown,
  expectedRecordType?: string,
): ValidationError[] {
  if (
    typeof record !== "object" ||
    record === null ||
    Array.isArray(record) ||
    !("recordType" in record) ||
    typeof record.recordType !== "string"
  ) {
    return [
      {
        file,
        invariant: "schema-validation",
        message: 'Structured AFF records require a string "recordType" field.',
        remediation:
          "Add recordType and schemaVersion fields from the schema catalogue.",
      },
    ];
  }

  const recordType = record.recordType;
  if (expectedRecordType && recordType !== expectedRecordType) {
    return [
      {
        file,
        invariant: "schema-validation",
        message: `Expected recordType "${expectedRecordType}" but found "${recordType}".`,
        remediation: `Set recordType to "${expectedRecordType}" for this file.`,
      },
    ];
  }

  const validator = registry.validators.get(recordType);
  if (!validator) {
    return [
      {
        file,
        invariant: "schema-validation",
        message: `Record type "${recordType}" is not in schemas/aff/catalogue.json.`,
        remediation:
          "Use a catalogued recordType or add a versioned schema and catalogue entry.",
      },
    ];
  }

  return validator(record)
    ? []
    : (validator.errors ?? []).map((error) =>
        schemaError(file, recordType, error),
      );
}
