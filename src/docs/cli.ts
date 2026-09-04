#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

import { Command, CommanderError } from "commander";

import { generateDocumentation } from "./generate.js";

interface DocumentationCliOptions {
  check: boolean;
  root: string;
}

export async function runDocumentationCli(argv: string[]): Promise<number> {
  const program = new Command();
  program
    .name("aff-docs")
    .description("Generate or verify lifecycle-derived AFF documentation.")
    .option("--root <path>", "repository root", process.cwd())
    .option("--check", "fail when generated documentation has drifted", false)
    .exitOverride();

  try {
    program.parse(argv);
    const options = program.opts<DocumentationCliOptions>();
    const result = await generateDocumentation(
      path.resolve(options.root),
      options.check,
    );
    if (options.check && result.changedFiles.length > 0) {
      console.error(
        `ERROR [documentation-drift] Regenerate: ${result.changedFiles.join(", ")}`,
      );
      return 1;
    }
    console.log(
      result.changedFiles.length === 0
        ? "Generated documentation is current."
        : `Updated generated documentation: ${result.changedFiles.join(", ")}`,
    );
    return 0;
  } catch (error: unknown) {
    if (error instanceof CommanderError && error.exitCode === 0) {
      return 0;
    }
    if (error instanceof CommanderError) {
      return 64;
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDocumentationCli(process.argv)
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
