#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

import { Command, CommanderError } from "commander";

import { diagnoseSetup, formatDoctorReport } from "./index.js";

export async function runDoctorCli(argv: string[]): Promise<number> {
  const program = new Command();
  program.name("aff-doctor")
    .description("Read-only local setup checks with explicit unverified host requirements.")
    .option("--root <path>", "repository root", process.cwd())
    .option("--home <path>", "home directory containing the local AFF identity")
    .option("--json", "print a machine-readable diagnostic report", false)
    .exitOverride();
  try {
    program.parse(argv);
  } catch (error: unknown) {
    if (error instanceof CommanderError) return error.exitCode === 0 ? 0 : 64;
    throw error;
  }
  const options = program.opts<{ root: string; home?: string; json: boolean }>();
  const report = await diagnoseSetup({ repositoryRoot: path.resolve(options.root), ...(options.home ? { home: path.resolve(options.home) } : {}) });
  console.log(options.json ? JSON.stringify(report, null, 2) : formatDoctorReport(report));
  return report.readiness === "blocked" ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDoctorCli(process.argv).then((code) => { process.exitCode = code; }).catch((error: unknown) => {
    console.error(`FATAL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  });
}
