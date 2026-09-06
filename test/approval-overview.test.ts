import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { renderApprovalOverview } from "../src/render/index.js";
import { runRenderCli } from "../src/render/cli.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories: string[] = [];

async function fixture() {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), "aff-approval-dashboard-"));
  temporaryDirectories.push(repositoryRoot);
  await cp(path.join(projectRoot, "schemas"), path.join(repositoryRoot, "schemas"), { recursive: true });
  await cp(path.join(projectRoot, ".github/agents/AFF-LIFECYCLE.json"), path.join(repositoryRoot, ".github/agents/AFF-LIFECYCLE.json"));
  const caseRoot = path.join(repositoryRoot, "cases/valid-case");
  await cp(path.join(projectRoot, "test/fixtures/cases/valid-case"), caseRoot, { recursive: true });
  const approvalPath = path.join(caseRoot, "approvals/phase-0/sample-phase-0-approval.json");
  const approval = JSON.parse(await readFile(approvalPath, "utf8"));
  approval.extensions = { syntheticTestEvidence: true, realApproval: false, approvalMode: "synthetic" };
  await writeFile(approvalPath, JSON.stringify(approval));
  return { repositoryRoot, caseRoot, approval, options: { repositoryRoot, casePath: "cases/valid-case" } };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("architect approval dashboard", () => {
  it("has unique navigation targets, landmarks and native disclosure controls", async () => {
    const { options, caseRoot } = await fixture();
    await renderApprovalOverview(options);
    const html = await readFile(path.join(caseRoot, "approval-overview.html"), "utf8");
    const elements: DefaultTreeAdapterTypes.Element[] = [];
    const visit = (node: DefaultTreeAdapterTypes.Node): void => {
      if ("tagName" in node) elements.push(node);
      if ("childNodes" in node) node.childNodes.forEach(visit);
    };
    visit(parse(html));
    const attr = (node: DefaultTreeAdapterTypes.Element, name: string) => node.attrs.find((a) => a.name === name)?.value;
    const ids = elements.flatMap((node) => attr(node, "id") ? [attr(node, "id")!] : []);
    expect(new Set(ids).size).toBe(ids.length);
    expect(elements.filter((node) => node.tagName === "main")).toHaveLength(1);
    expect(elements.filter((node) => node.tagName === "h1")).toHaveLength(1);
    expect(elements.filter((node) => node.tagName === "nav").every((node) => Boolean(attr(node, "aria-label")))).toBe(true);
    for (const node of elements) {
      const href = attr(node, "href");
      if (href?.startsWith("#")) expect(ids).toContain(href.slice(1));
      if (node.tagName === "details") {
        const children = node.childNodes.filter((child) => "tagName" in child);
        expect(children[0]?.nodeName).toBe("summary");
      }
      expect(attr(node, "tabindex") === undefined || Number(attr(node, "tabindex")) <= 0).toBe(true);
    }
    expect(html).toContain(":focus-visible");
    expect(html).toContain(".skip-link:focus");
    expect(html).toContain("prefers-reduced-motion");
  });
  it("renders invalid case diagnostics, all decision history, safe text and key rotations", async () => {
    const { options, caseRoot, approval } = await fixture();
    await writeFile(path.join(caseRoot, "approvals/phase-0/sample-rejection.json"), JSON.stringify({
      ...approval, decision: "REJECTED", decidedAt: "2026-01-02T10:10:00Z",
      approver: "<script>alert('unsafe')</script>",
      extensions: { ...approval.extensions, keyRotation: { previousKeyFingerprint: "previous-key", reason: "<img src=x onerror=alert(1)>" } },
    }));
    await writeFile(path.join(caseRoot, "approvals/phase-0/broken.json"), "{broken");
    await renderApprovalOverview(options);
    const html = await readFile(path.join(caseRoot, "approval-overview.html"), "utf8");
    expect(html).toContain("APPROVED");
    expect(html).toContain("REJECTED");
    expect(html).toContain("json-syntax");
    expect(html).toContain("not validated approval or permission to continue");
    expect(html).toContain("Synthetic test evidence");
    expect(html).toContain("Recorded key rotation");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain('href="approvals/phase-0/sample-phase-0-approval.json"');
    expect(html).toContain("does not update automatically");
    expect(html).toContain("npm run render -- approvals --case cases/valid-case");
    expect(html).toContain("script-src 'none'");
  });

  it("renders an empty case without implying approval", async () => {
    const { repositoryRoot } = await fixture();
    await mkdir(path.join(repositoryRoot, "cases/empty-case"));
    const result = await runRenderCli(["node", "render", "approvals", "--root", repositoryRoot, "--case", "cases/empty-case"]);
    expect(result).toBe(0);
    const html = await readFile(path.join(repositoryRoot, "cases/empty-case/approval-overview.html"), "utf8");
    expect(html).toContain("Not invoked");
    expect(html).toContain("No readable human-decision records");
    expect(html).toContain("cannot approve, sign, or execute anything");
  });

  it("keeps dashboard cards out of the phase document's fixed grid cell", async () => {
    const { options, caseRoot } = await fixture();
    await renderApprovalOverview(options);
    const html = await readFile(path.join(caseRoot, "approval-overview.html"), "utf8");
    const css = html.match(/<style>([\s\S]*?)<\/style>/u)?.[1] ?? "";
    const globalArticleRules = [...css.matchAll(/(?:^|\})\s*article\s*\{([^}]*)\}/gu)];
    expect(globalArticleRules.length).toBeGreaterThan(0);
    for (const rule of globalArticleRules) expect(rule[1]).not.toMatch(/grid-(?:row|column)\s*:/u);
    expect(css).toMatch(/\.phase-grid>article\{[^}]*grid-column:auto;grid-row:auto/u);
    expect(css).toContain("grid-template-columns:minmax(0,1fr)");
    expect(html.match(/<article class="step" id="phase-[0-8]">/gu)).toHaveLength(9);
    const phaseCards = [...html.matchAll(/<article class="step" id="phase-[0-8]">([\s\S]*?)<\/article>/gu)];
    for (const [, card] of phaseCards) {
      expect(card).toContain("<h3>");
      expect(card).not.toContain("<h2>");
    }
    expect(html).toContain('class="wrap topbar-inner"');
    expect(html).toContain('class="metrics"');
    expect(css).toContain('--bg:#08080a');
    expect(css).toContain('AAv2Mono');
    expect(html).toContain("font-src data:");
    for (const target of ["phases", "diagnostics", "blockers", "history"]) {
      expect(html).toContain(`href="#${target}"`);
      expect(html).toContain(`id="${target}"`);
    }
  });

  it("refuses traversal and symlink output without changing the destination", async () => {
    const { options, caseRoot, repositoryRoot } = await fixture();
    await expect(renderApprovalOverview({ ...options, outputPath: "../outside.html" })).rejects.toThrow("case root");
    const destination = path.join(repositoryRoot, "outside.html");
    await writeFile(destination, "untouched");
    await symlink(destination, path.join(caseRoot, "approval-overview.html"));
    await expect(renderApprovalOverview(options)).rejects.toThrow();
    expect(await readFile(destination, "utf8")).toBe("untouched");
  });
});
