import { resolveCasePath } from "./path.js";
import type { ValidationResult } from "../types.js";
import { loadCaseRecords, type LoadedCaseRecords } from "./records.js";
import { validateHashBindings } from "./hash.js";
import { readLifecycle } from "../framework/lifecycle.js";
import { validateApprovals } from "./approvals.js";
import { validateApprovalModes } from "./approval-mode.js";
import { validateReviewConvergence } from "./convergence.js";
import { validateCandidateFileCoverage } from "./coverage.js";
import { validateRecordIdentity } from "./identity.js";
import { validateImplementationGraphs } from "./implementation.js";
import { validateRunJournals } from "./journal.js";
import { validateModelPlans, validateReviewModels } from "./models.js";
import { validatePhaseSequence } from "./sequence.js";

export async function validateCase(
  repositoryRoot: string,
  casePath: string,
): Promise<ValidationResult> {
  const resolved = await resolveCasePath(repositoryRoot, casePath);
  if (!resolved.caseRoot) {
    return { errors: resolved.errors };
  }

  const loaded = await loadCaseRecords(repositoryRoot, resolved.caseRoot);
  return validateLoadedCase(repositoryRoot, resolved.caseRoot, loaded);
}

export async function validateLoadedCase(
  repositoryRoot: string,
  caseRoot: string,
  loaded: LoadedCaseRecords,
): Promise<ValidationResult> {
  const lifecycle = await readLifecycle(repositoryRoot);
  const hashErrors = await validateHashBindings(
    caseRoot,
    loaded.records,
  );
  const coverageErrors = await validateCandidateFileCoverage(
    caseRoot,
    loaded.records,
  );
  return {
    errors: [
      ...loaded.errors,
      ...validateRecordIdentity(caseRoot, loaded.records),
      ...validateModelPlans(loaded.records, lifecycle),
      ...validateReviewModels(loaded.records, lifecycle),
      ...coverageErrors,
      ...validateImplementationGraphs(loaded.records),
      ...validateRunJournals(loaded.records),
      ...hashErrors,
      ...validateReviewConvergence(loaded.records),
      ...validateApprovals(loaded.records),
      ...validateApprovalModes(loaded.records),
      ...validatePhaseSequence(loaded.records, lifecycle),
    ],
  };
}
