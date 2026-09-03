#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

import { Command, CommanderError } from "commander";

import { validateCase } from "./case/index.js";
import { validateFramework } from "./framework/index.js";
import type { ValidationError, ValidationResult } from "./types.js";

interface CliOptions {
  case?: string;
  frameworkOnly: boolean;
  root: string;
}

export function formatErrors(errors: ValidationError[]): string {
  return errors
    .map(
      ({ file, invariant, message, remediation }) =>
        `ERROR [${invariant}] ${file}\n  ${message}\n  Fix: ${remediation}`,
    )
    .join("\n\n");
}

export async function validateRepository(
  repositoryRoot: string,
  casePath?: string,
): Promise<ValidationResult> {
  const framework = await validateFramework(repositoryRoot);
  if (!casePath) {
    return framework;
  }
  const caseResult = await validateCase(repositoryRoot, casePath);
  return { errors: [...framework.errors, ...caseResult.errors] };
}

export async function runCli(argv: string[]): Promise<number> {
  const program = new Command();
  program
    .name("aff-validate")
    .description("Validate the AFF framework and optional case records.")
    .option("--case <path>", "validate one case beneath cases/<case-name>")
    .option(
      "--framework-only",
      "validate repository profiles, lifecycle, schemas, and references only",
      false,
    )
    .option("--root <path>", "repository root", process.cwd())
    .exitOverride();

  try {
    program.parse(argv);
  } catch (error: unknown) {
    if (error instanceof CommanderError && error.exitCode === 0) {
      return 0;
    }
    if (error instanceof CommanderError) {
      return 64;
    }
    throw error;
  }

  const options = program.opts<CliOptions>();
  if (options.case && options.frameworkOnly) {
    console.error("ERROR: --case and --framework-only cannot be used together.");
    return 64;
  }

  const repositoryRoot = path.resolve(options.root);
  const result = await validateRepository(
    repositoryRoot,
    options.frameworkOnly ? undefined : options.case,
  );
  if (result.errors.length > 0) {
    console.error(formatErrors(result.errors));
    return 1;
  }

  console.log(
    options.case
      ? `AFF validation passed for the framework and ${options.case}.`
      : "AFF framework validation passed.",
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv)
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      if (!(error instanceof Error)) {
        throw error;
      }
      console.error(`FATAL: ${error.message}`);
      process.exitCode = 2;
    });
}
