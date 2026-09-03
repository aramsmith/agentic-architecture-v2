import { access, readFile } from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";

import { toRepositoryPath } from "../common/path.js";
import type { ValidationError } from "../types.js";

function extractReferences(content: string): string[] {
  const references: string[] = [];
  for (const match of content.matchAll(/`([^`\r\n]+)`/gu)) {
    if (match[1]) {
      references.push(match[1]);
    }
  }
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/gu)) {
    if (match[1]) {
      references.push(match[1]);
    }
  }
  return references;
}

function isConcreteRepositoryReference(reference: string): boolean {
  return (
    (/^(?:\.github|cases|docs|schemas|src|test)\//u.test(reference) ||
      /^(?:README\.md|package(?:-lock)?\.json|tsconfig\.json)$/u.test(reference)) &&
    !/[<>{}*]/u.test(reference)
  );
}

export async function validateReferences(
  repositoryRoot: string,
): Promise<ValidationError[]> {
  const files = await fg([".github/**/*.{md,json}", "README.md"], {
    cwd: repositoryRoot,
    onlyFiles: true,
  });
  const errors: ValidationError[] = [];

  await Promise.all(
    files.map(async (relativeFile) => {
      const file = toRepositoryPath(relativeFile);
      const content = await readFile(path.join(repositoryRoot, relativeFile), "utf8");
      for (const reference of extractReferences(content)) {
        if (/^(?:agents|skills)\//u.test(reference)) {
          errors.push({
            file,
            invariant: "stale-root-reference",
            message: `Reference "${reference}" uses a removed root agents/skills path.`,
            remediation: `Change it to ".github/${reference}".`,
          });
        }

        if (!isConcreteRepositoryReference(reference)) {
          continue;
        }

        try {
          await access(path.join(repositoryRoot, reference));
        } catch (error: unknown) {
          if (
            !(error instanceof Error) ||
            !("code" in error) ||
            error.code !== "ENOENT"
          ) {
            throw error;
          }
          errors.push({
            file,
            invariant: "internal-reference-resolution",
            message: `Concrete repository reference "${reference}" does not exist.`,
            remediation: "Correct the path or add the referenced repository file.",
          });
        }
      }
    }),
  );

  return errors;
}
