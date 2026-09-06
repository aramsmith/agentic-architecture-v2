#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Command, CommanderError } from "commander";
import { createStandardJourney } from "./standard.js";

export async function runStandardJourneyCli(argv: string[]): Promise<number> {
  const program = new Command().name("demo:approvals")
    .description("Generate a synthetic Phase 0–6 approval dashboard. No real approvals, models, Azure or DECKIO execution.")
    .option("--root <path>", "source repository", process.cwd())
    .option("--output <path>", "empty output directory", ".aff-smoke/approval-demo")
    .exitOverride();
  try {
    program.parse(argv);
    const options = program.opts<{ root: string; output: string }>();
    const result = await createStandardJourney(path.resolve(options.root), path.resolve(options.output), true);
    console.log(`Synthetic approval dashboard: ${path.join(result.caseRoot, "approval-overview.html")}`);
    console.log("Contract fixture only: no live model, human decision, application test, DECKIO export or Azure action occurred.");
    return 0;
  } catch (error: unknown) {
    if (error instanceof CommanderError) return error.exitCode === 0 ? 0 : 64;
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runStandardJourneyCli(process.argv);
}
