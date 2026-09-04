import { isRecord } from "../common/json.js";
import type { ValidationError } from "../types.js";
import type { LoadedRecord } from "./records.js";

interface ImplementationUnit {
  id: string;
  dependsOn: string[];
}

function isImplementationUnit(value: unknown): value is ImplementationUnit {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.dependsOn) &&
    value.dependsOn.every((dependency) => typeof dependency === "string")
  );
}

export function validateImplementationGraphs(
  records: LoadedRecord[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const record of records.filter(
    ({ value }) => value.recordType === "implementation-catalogue",
  )) {
    const units = record.value.units;
    if (!Array.isArray(units) || !units.every(isImplementationUnit)) {
      continue;
    }
    const byId = new Map(units.map((unit) => [unit.id, unit]));
    if (byId.size !== units.length) {
      errors.push({
        file: record.file,
        invariant: "implementation-dag",
        message: "Implementation unit IDs must be unique.",
        remediation:
          "Give every deployable or non-deployable unit one immutable unique ID.",
      });
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (unitId: string): void => {
      if (visiting.has(unitId)) {
        errors.push({
          file: record.file,
          invariant: "implementation-dag",
          message: `Implementation dependency cycle includes "${unitId}".`,
          remediation:
            "Remove the circular dependsOn relationship and keep the deployment graph acyclic.",
        });
        return;
      }
      if (visited.has(unitId)) {
        return;
      }
      const unit = byId.get(unitId);
      if (!unit) {
        return;
      }
      visiting.add(unitId);
      for (const dependency of unit.dependsOn) {
        if (!byId.has(dependency)) {
          errors.push({
            file: record.file,
            invariant: "implementation-dag",
            message: `Unit "${unitId}" depends on missing unit "${dependency}".`,
            remediation:
              "Add the referenced unit or correct the dependsOn identifier.",
          });
        } else {
          visit(dependency);
        }
      }
      visiting.delete(unitId);
      visited.add(unitId);
    };

    for (const unit of units) {
      visit(unit.id);
    }
  }
  return errors;
}
