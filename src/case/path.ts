import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type { ValidationError } from "../types.js";

export interface ResolvedCasePath {
  caseRoot?: string;
  errors: ValidationError[];
}

export interface ResolvedCaseFile {
  absolutePath?: string;
  error?: ValidationError;
}

export function isPathContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== "" &&
    !path.isAbsolute(relative) &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`)
  );
}

export async function resolveContainedCaseFile(
  caseRoot: string,
  requestedPath: string,
  purpose: string,
): Promise<ResolvedCaseFile> {
  const error = (message: string, remediation: string): ResolvedCaseFile => ({
    error: {
      file: requestedPath,
      invariant: "case-path-containment",
      message,
      remediation,
    },
  });
  if (
    requestedPath.trim() === "" ||
    path.isAbsolute(requestedPath) ||
    requestedPath.split(/[\\/]+/u).includes("..")
  ) {
    return error(
      `${purpose} must be a case-relative path without parent traversal.`,
      "Use a path beneath the case directory.",
    );
  }

  const candidate = path.resolve(caseRoot, requestedPath);
  if (!isPathContained(caseRoot, candidate)) {
    return error(
      `${purpose} escapes the case directory.`,
      "Use a path beneath the case directory.",
    );
  }

  try {
    if ((await lstat(candidate)).isSymbolicLink()) {
      return error(
        `${purpose} cannot be a symbolic link or junction.`,
        "Use a physical file beneath the case directory.",
      );
    }
    if (!(await stat(candidate)).isFile()) {
      return error(
        `${purpose} is not a file.`,
        "Use an existing physical file beneath the case directory.",
      );
    }
    const physicalRoot = await realpath(caseRoot);
    const physicalCandidate = await realpath(candidate);
    if (!isPathContained(physicalRoot, physicalCandidate)) {
      return error(
        `${purpose} resolves outside the case directory.`,
        "Remove the link or junction and use a physical case file.",
      );
    }
  } catch (caught: unknown) {
    if (
      caught instanceof Error &&
      "code" in caught &&
      caught.code === "ENOENT"
    ) {
      return error(
        `${purpose} does not exist.`,
        "Create the file beneath the case directory or correct the path.",
      );
    }
    throw caught;
  }

  return { absolutePath: candidate };
}

export async function resolveContainedOutputPath(
  caseRoot: string,
  requestedPath: string,
): Promise<ResolvedCaseFile> {
  if (
    requestedPath.trim() === "" ||
    path.isAbsolute(requestedPath) ||
    requestedPath.split(/[\\/]+/u).includes("..")
  ) {
    return {
      error: {
        file: requestedPath,
        invariant: "case-path-containment",
        message:
          "Renderer output must be a case-relative path without parent traversal.",
        remediation: "Write the HTML beneath the case directory.",
      },
    };
  }
  const candidate = path.resolve(caseRoot, requestedPath);
  if (!isPathContained(caseRoot, candidate)) {
    return {
      error: {
        file: requestedPath,
        invariant: "case-path-containment",
        message: "Renderer output escapes the case directory.",
        remediation: "Write the HTML beneath the case directory.",
      },
    };
  }

  const physicalRoot = await realpath(caseRoot);
  const parent = path.dirname(candidate);
  const physicalParent = await realpath(parent);
  if (
    physicalParent !== physicalRoot &&
    !isPathContained(physicalRoot, physicalParent)
  ) {
    return {
      error: {
        file: requestedPath,
        invariant: "case-path-containment",
        message: "Renderer output parent resolves outside the case directory.",
        remediation:
          "Remove the link or junction and use a physical case directory.",
      },
    };
  }
  try {
    const existing = await lstat(candidate);
    if (existing.isSymbolicLink()) {
      return {
        error: {
          file: requestedPath,
          invariant: "case-path-containment",
          message: "Renderer output cannot be a symbolic link or junction.",
          remediation:
            "Remove the link or junction and use a physical HTML file beneath the case directory.",
        },
      };
    }
    if (!existing.isFile()) {
      return {
        error: {
          file: requestedPath,
          invariant: "case-path-containment",
          message: "Renderer output path exists but is not a file.",
          remediation:
            "Choose the contracted HTML filename and remove the conflicting directory.",
        },
      };
    }
    const physicalCandidate = await realpath(candidate);
    if (!isPathContained(physicalRoot, physicalCandidate)) {
      return {
        error: {
          file: requestedPath,
          invariant: "case-path-containment",
          message: "Renderer output resolves outside the case directory.",
          remediation:
            "Remove the link or junction and use a physical case HTML file.",
        },
      };
    }
  } catch (caught: unknown) {
    if (
      !(caught instanceof Error) ||
      !("code" in caught) ||
      caught.code !== "ENOENT"
    ) {
      throw caught;
    }
  }
  return { absolutePath: candidate };
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
