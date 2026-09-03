import { resolveCasePath } from "./path.js";
import type { ValidationResult } from "../types.js";
import { loadCaseRecords } from "./records.js";
import { validateHashBindings } from "./hash.js";
import { readLifecycle } from "../framework/lifecycle.js";
import { validateApprovals } from "./approvals.js";
import { validateReviewConvergence } from "./convergence.js";
import { validateCandidateFileCoverage } from "./coverage.js";
import { validateRecordIdentity } from "./identity.js";
import { validateImplementationGraphs } from "./implementation.js";
import { validateRunJournals } from "./journal.js";
import { validateModelPlans, validateReviewModels } from "./models.js";

export async function validateCase(
  repositoryRoot: string,
  casePath: string,
): Promise<ValidationResult> {
  const resolved = await resolveCasePath(repositoryRoot, casePath);
  if (!resolved.caseRoot) {
    return { errors: resolved.errors };
  }

  const loaded = await loadCaseRecords(repositoryRoot, resolved.caseRoot);
  const lifecycle = await readLifecycle(repositoryRoot);
  const hashErrors = await validateHashBindings(
    resolved.caseRoot,
    loaded.records,
  );
  const coverageErrors = await validateCandidateFileCoverage(
    resolved.caseRoot,
    loaded.records,
  );
  return {
    errors: [
      ...loaded.errors,
      ...validateRecordIdentity(resolved.caseRoot, loaded.records),
      ...validateModelPlans(loaded.records, lifecycle),
      ...validateReviewModels(loaded.records, lifecycle),
      ...coverageErrors,
      ...validateImplementationGraphs(loaded.records),
      ...validateRunJournals(loaded.records),
      ...hashErrors,
      ...validateReviewConvergence(loaded.records),
      ...validateApprovals(loaded.records),
    ],
  };
}
