import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type { ValidationError } from "../types.js";

export interface ResolvedCasePath {
  caseRoot?: string;
  errors: ValidationError[];
}

export async function resolveCasePath(
  repositoryRoot: string,
  requestedPath: string,
): Promise<ResolvedCasePath> {
  const casesRoot = path.resolve(repositoryRoot, "cases");
  if (path.isAbsolute(requestedPath)) {
    return {
      errors: [
        {
          file: requestedPath,
          invariant: "case-path-containment",
          message: "Absolute case paths are not accepted.",
          remediation:
            "Pass a repository-relative path such as cases/<case-name>.",
        },
      ],
    };
  }
  if (requestedPath.split(/[\\/]+/u).includes("..")) {
    return {
      errors: [
        {
          file: requestedPath,
          invariant: "case-path-containment",
          message: "Parent traversal segments are not accepted in a case path.",
          remediation:
            "Pass the direct repository-relative path cases/<case-name>.",
        },
      ],
    };
  }
  const candidate = path.resolve(repositoryRoot, requestedPath);
  const relative = path.relative(casesRoot, candidate);
  const segments = relative.split(path.sep).filter(Boolean);

  if (
    relative === "" ||
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    segments.length !== 1
  ) {
    return {
      errors: [
        {
          file: requestedPath,
          invariant: "case-path-containment",
          message:
            "The case path must identify one direct child directory beneath cases/.",
          remediation:
            "Pass a path such as cases/<case-name>; parent paths and nested subdirectories are rejected.",
        },
      ],
    };
  }

  try {
    if ((await lstat(candidate)).isSymbolicLink()) {
      return {
        errors: [
          {
            file: requestedPath,
            invariant: "case-path-containment",
            message: "The case directory cannot be a symbolic link or junction.",
            remediation: "Use a physical directory directly beneath cases/.",
          },
        ],
      };
    }
    const details = await stat(candidate);
    if (!details.isDirectory()) {
      return {
        errors: [
          {
            file: requestedPath,
            invariant: "case-path-containment",
            message: "The requested case path is not a directory.",
            remediation: "Pass the case directory, not an individual artifact.",
          },
        ],
      };
    }
    const physicalCasesRoot = await realpath(casesRoot);
    const physicalCandidate = await realpath(candidate);
    const physicalRelative = path.relative(
      physicalCasesRoot,
      physicalCandidate,
    );
    if (
      path.isAbsolute(physicalRelative) ||
      physicalRelative === ".." ||
      physicalRelative.startsWith(`..${path.sep}`) ||
      physicalRelative.split(path.sep).filter(Boolean).length !== 1
    ) {
      return {
        errors: [
          {
            file: requestedPath,
            invariant: "case-path-containment",
            message: "The physical case directory resolves outside cases/.",
            remediation:
              "Remove the link or junction and use a physical case directory.",
          },
        ],
      };
    }
  } catch (error: unknown) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
    return {
      errors: [
        {
          file: requestedPath,
          invariant: "case-path-containment",
          message: "The requested case directory does not exist.",
          remediation: "Create the case beneath cases/ or correct the supplied path.",
        },
      ],
    };
  }

  return { caseRoot: candidate, errors: [] };
}
