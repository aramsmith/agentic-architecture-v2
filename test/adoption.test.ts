import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse } from "parse5";

import {
  generateDocumentation,
  renderReadmeRoster,
  renderSiteRoster,
} from "../src/docs/generate.js";
import { readLifecycle } from "../src/framework/lifecycle.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function read(relativePath: string): Promise<string> {
  return readFile(
    path.join(repositoryRoot, ...relativePath.split("/")),
    "utf8",
  );
}

describe("architect adoption and release surfaces", () => {
  it("keeps lifecycle-derived documentation deterministic and current", async () => {
    const lifecycle = await readLifecycle(repositoryRoot);
    const [readme, site, result] = await Promise.all([
      read("README.md"),
      read("agentic-architecture-v2.html"),
      generateDocumentation(repositoryRoot, true),
    ]);

    expect(result.changedFiles).toEqual([]);
    expect(readme).toContain(renderReadmeRoster(lifecycle));
    expect(site).toContain(renderSiteRoster(lifecycle));
    expect(readme.match(/BEGIN GENERATED: AFF-LIFECYCLE-ROSTER/gu)).toHaveLength(
      1,
    );
    expect(site.match(/BEGIN GENERATED: AFF-LIFECYCLE-ROSTER/gu)).toHaveLength(1);
  });

  it("documents one clear offline path and separates optional live actions", async () => {
    const quickStart = await read("docs/quick-start.md");

    for (const command of [
      "npm ci --no-audit --no-fund",
      "npm run validate -- --framework-only",
      "npm run smoke:contoso -- --keep-output .\\.aff-smoke\\contoso-review",
      "Get-Content .\\.aff-smoke\\contoso-review\\smoke-report.json",
      "Invoke-Item .\\.aff-smoke\\contoso-review\\cases\\contoso-permit-services\\solution-overview.html",
    ]) {
      expect(quickStart).toContain(command);
    }
    expect(quickStart).toContain("## 1. Local deterministic evaluation");
    expect(quickStart).toContain("## 2. Optional GitHub Copilot agent trial");
    expect(quickStart).toContain(
      "## 3. Optional human-authorised Azure deployment and testing",
    );
    expect(quickStart).toMatch(/Safe stop point/gu);
    expect(quickStart).toContain(
      "does not call a model, access Azure, deploy anything, or create a real",
    );
  });

  it("keeps compatibility versions aligned with authoritative metadata", async () => {
    const [compatibility, packageJson, lifecycle, catalogue] = await Promise.all([
      read("docs/compatibility.md"),
      read("package.json").then((value) => JSON.parse(value) as { version: string }),
      readLifecycle(repositoryRoot),
      read("schemas/aff/catalogue.json").then(
        (value) => JSON.parse(value) as { contractVersion: string },
      ),
    ]);

    expect(compatibility).toContain(`| AFF lifecycle | \`${lifecycle.version}\``);
    expect(compatibility).toContain(
      `| AFF schema contract | \`${catalogue.contractVersion}\``,
    );
    expect(compatibility).toContain(
      `| Validator/tool package | \`${packageJson.version}\`, private package`,
    );
    expect(compatibility).toContain("| Windows |");
    expect(compatibility).toContain("| Linux |");
    expect(compatibility).toContain("| macOS |");
    expect(compatibility).toContain("| GitHub Copilot CLI |");
    expect(compatibility).toContain("| Azure |");
    expect(compatibility).toContain("A silent fallback is not supported.");
  });

  it("publishes representative evidence without presenting synthetic approval as real", async () => {
    const evidence = await read("docs/examples/contoso-phase-0-evidence.md");
    const hashes = [...evidence.matchAll(/`([0-9a-f]{64})`/gu)].map(
      (match) => match[1],
    );

    expect(hashes).toHaveLength(4);
    expect(new Set(hashes).size).toBe(4);
    expect(evidence).toContain("Synthetic test evidence only.");
    expect(evidence).toContain("not a real human or architecture approval");
    expect(evidence).toContain("`extensions.realApproval`: `false`");
    expect(evidence).toContain("Both final reviewer records");
    expect(evidence).toContain("AFF-1 asks:");
    expect(evidence).toContain("No requirement is baselined");
    expect(evidence).toContain("solution-overview.html");
    expect(evidence).toContain("npm run docs:generate");
  });

  it("keeps the public website self-contained, accessible, and operationally useful", async () => {
    const [site, pagesWorkflow] = await Promise.all([
      read("agentic-architecture-v2.html"),
      read(".github/workflows/pages.yml"),
    ]);
    const parseErrors: string[] = [];
    parse(site, {
      onParseError: (error) => {
        parseErrors.push(error.code);
      },
    });
    const ids = [...site.matchAll(/\bid="([^"]+)"/gu)].map((match) => match[1]);

    expect(parseErrors).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(site).toContain('<html lang="en">');
    expect(site).toContain('http-equiv="Content-Security-Policy"');
    expect(site).toContain("default-src 'none'");
    expect(site).toContain("connect-src 'none'");
    expect(site).toContain('id="evaluate"');
    expect(site).toContain('id="operate"');
    expect(site).toContain("npm run smoke:contoso");
    expect(site).toContain("Safe stop point");
    expect(site).toContain("zero live model calls");
    expect(site).not.toMatch(/<(?:script|img|link)[^>]+(?:src|href)="https?:/iu);
    expect(site).not.toMatch(/\b(?:eval|document\.write|innerHTML)\s*\(/u);
    expect(site.match(/<button\b[^>]*type="button"/gu)?.length ?? 0).toBeGreaterThan(
      4,
    );
    expect(site).toContain('aria-label="Page navigation"');
    expect(site).toContain('aria-labelledby="ringTitle ringDesc"');
    for (const document of [
      "compatibility.md",
      "troubleshooting.md",
      "release-process.md",
    ]) {
      expect(pagesWorkflow).toContain(`cp docs/${document} _site/docs/${document}`);
    }
  });

  it("defines release and migration gates without claiming a release", async () => {
    const [changelog, release, migrations] = await Promise.all([
      read("CHANGELOG.md"),
      read("docs/release-process.md"),
      read("docs/migrations/README.md"),
    ]);

    expect(changelog).toContain("## Unreleased");
    expect(changelog).toContain("No GitHub release or tag has been created.");
    expect(release).toContain("AFF currently has no tagged public release.");
    expect(release).toContain("npm run docs:check");
    expect(release).toContain("Repository validation and CodeQL pass");
    expect(release).toContain("git status --short");
    expect(migrations).toContain(
      "docs/migrations/<from-version>-to-<to-version>.md",
    );
    expect(migrations).toContain("rollback or safe-stop guidance");
  });
});
