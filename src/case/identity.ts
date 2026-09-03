import path from "node:path";

import type { ValidationError } from "../types.js";
import type { LoadedRecord } from "./records.js";

export function validateRecordIdentity(
  caseRoot: string,
  records: LoadedRecord[],
): ValidationError[] {
  const expectedCaseName = path.basename(caseRoot);
  const identities = records.flatMap(({ file, value }) =>
    typeof value.caseName === "string" &&
    typeof value.artifactPrefix === "string"
      ? [{ file, caseName: value.caseName, artifactPrefix: value.artifactPrefix }]
      : [],
  );
  const expectedPrefix = identities[0]?.artifactPrefix;

  return identities.flatMap(({ file, caseName, artifactPrefix }) => {
    const errors: ValidationError[] = [];
    if (caseName !== expectedCaseName) {
      errors.push({
        file,
        invariant: "case-record-identity",
        message: `Record caseName "${caseName}" differs from directory "${expectedCaseName}".`,
        remediation: "Use the immutable case directory name in every AFF record.",
      });
    }
    if (expectedPrefix && artifactPrefix !== expectedPrefix) {
      errors.push({
        file,
        invariant: "case-record-identity",
        message: `Record artifactPrefix "${artifactPrefix}" differs from "${expectedPrefix}".`,
        remediation: "Use the Phase 0 artifactPrefix consistently across the case.",
      });
    }
    return errors;
  });
}
