import { readFile } from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";

import { toRepositoryPath } from "../common/path.js";
import type { ValidationError } from "../types.js";

export async function validateRepositoryJson(
  repositoryRoot: string,
): Promise<ValidationError[]> {
  const files = await fg(
    [
      ".github/**/*.json",
      "cases/**/*.json",
      "schemas/**/*.json",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
    ],
    {
      cwd: repositoryRoot,
      onlyFiles: true,
      ignore: ["node_modules/**", "dist/**"],
    },
  );

  const results = await Promise.all(
    files.map(async (relativeFile): Promise<ValidationError[]> => {
      const file = toRepositoryPath(relativeFile);
      try {
        JSON.parse(await readFile(path.join(repositoryRoot, relativeFile), "utf8"));
        return [];
      } catch (error: unknown) {
        if (!(error instanceof SyntaxError)) {
          throw error;
        }
        return [
          {
            file,
            invariant: "json-syntax",
            message: `Invalid JSON: ${error.message}`,
            remediation: "Correct the JSON syntax and run validation again.",
          },
        ];
      }
    }),
  );

  return results.flat();
}
