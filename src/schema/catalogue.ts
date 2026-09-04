import { readFile } from "node:fs/promises";
import path from "node:path";

export type RecordFormat = "json" | "jsonl";

export interface SchemaCatalogueEntry {
  recordType: string;
  file: string;
  format: RecordFormat;
  patterns: string[];
}

export interface SchemaCatalogue {
  contractVersion: string;
  jsonSchemaDraft: string;
  schemas: SchemaCatalogueEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEntry(value: unknown): value is SchemaCatalogueEntry {
  return (
    isRecord(value) &&
    typeof value.recordType === "string" &&
    typeof value.file === "string" &&
    (value.format === "json" || value.format === "jsonl") &&
    Array.isArray(value.patterns) &&
    value.patterns.every((pattern) => typeof pattern === "string")
  );
}

function isCatalogue(value: unknown): value is SchemaCatalogue {
  return (
    isRecord(value) &&
    typeof value.contractVersion === "string" &&
    typeof value.jsonSchemaDraft === "string" &&
    Array.isArray(value.schemas) &&
    value.schemas.every(isEntry)
  );
}

export async function readSchemaCatalogue(
  repositoryRoot: string,
): Promise<SchemaCatalogue> {
  const file = path.join(repositoryRoot, "schemas", "aff", "catalogue.json");
  const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!isCatalogue(parsed)) {
    throw new TypeError(
      "schemas/aff/catalogue.json does not contain a valid schema catalogue.",
    );
  }
  return parsed;
}
