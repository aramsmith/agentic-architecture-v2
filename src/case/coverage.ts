import fg from "fast-glob";

import type { ValidationError } from "../types.js";
import type { LoadedRecord } from "./records.js";
import {
  latestCandidateEvents,
  phaseFolders,
} from "./review-records.js";

export async function validateCandidateFileCoverage(
  caseRoot: string,
  records: LoadedRecord[],
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  for (const candidate of latestCandidateEvents(records).values()) {
    const folder = phaseFolders[candidate.phaseId];
    if (!folder) {
      continue;
    }
    const phaseFiles = await fg(`${folder}/**/*`, {
      cwd: caseRoot,
      onlyFiles: true,
      followSymbolicLinks: false,
    });
    const reviewedPaths = new Set(
      candidate.artifacts.map(({ path }) => path),
    );
    const missing = phaseFiles.filter(
      (phaseFile) => !reviewedPaths.has(phaseFile),
    );
    if (missing.length > 0) {
      errors.push({
        file: candidate.file,
        invariant: "review-convergence",
        message: `Current candidate omits phase file(s): ${missing.join(", ")}.`,
        remediation:
          "Include every generated phase artifact, diagram, code, and evidence file in the journalled review set.",
      });
    }
  }
  return errors;
}
