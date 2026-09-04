import { isRecord } from "../common/json.js";
import type { LifecycleManifest, ValidationError } from "../types.js";
import type { ParsedProfile } from "./frontmatter.js";

const invariant = "tool-least-privilege";

const supportedBaseTools = new Set([
  "read",
  "search",
  "edit",
  "execute",
  "web",
  "agent",
  "todo",
]);

const reviewerForbiddenTools = new Set(["execute", "agent"]);

function declaredMcpTools(
  mcpServers: Record<string, unknown> | undefined,
): Map<string, Set<string>> {
  const servers = new Map<string, Set<string>>();
  for (const [name, configuration] of Object.entries(mcpServers ?? {})) {
    const tools =
      isRecord(configuration) && Array.isArray(configuration.tools)
        ? configuration.tools.filter(
            (tool): tool is string => typeof tool === "string",
          )
        : [];
    servers.set(name, new Set(tools));
  }
  return servers;
}

export function validateToolGrants(
  profiles: ParsedProfile[],
  lifecycle: LifecycleManifest,
): ValidationError[] {
  const reviewerOwners = new Set(lifecycle.reviewers.map(({ owner }) => owner));
  const errors: ValidationError[] = [];

  for (const { file, frontmatter } of profiles) {
    if (!file.endsWith(".agent.md") || !frontmatter?.tools) {
      continue;
    }
    const servers = declaredMcpTools(frontmatter.mcpServers);
    const isReviewer = reviewerOwners.has(frontmatter.name);

    if (!frontmatter.tools.includes("read")) {
      errors.push({
        file,
        invariant,
        message: "An AFF agent must declare the read tool.",
        remediation:
          "Add read to the tools array so the agent can consult the operating contract and case evidence.",
      });
    }

    for (const tool of frontmatter.tools) {
      const separator = tool.indexOf("/");

      if (separator < 0) {
        if (!supportedBaseTools.has(tool)) {
          errors.push({
            file,
            invariant,
            message: `Tool "${tool}" is not a supported AFF capability.`,
            remediation: `Use one of ${[...supportedBaseTools].sort().join(", ")}, or a namespaced <mcp-server>/<tool> declared in this profile.`,
          });
          continue;
        }
        if (isReviewer && reviewerForbiddenTools.has(tool)) {
          errors.push({
            file,
            invariant,
            message: `Reviewer ${frontmatter.name} declares the "${tool}" tool.`,
            remediation:
              "Reviewers challenge and record findings only. Remove execute and agent so a reviewer cannot run commands or drive other agents.",
          });
        }
        continue;
      }

      const server = tool.slice(0, separator);
      const operation = tool.slice(separator + 1);
      const declared = servers.get(server);
      if (!declared) {
        errors.push({
          file,
          invariant,
          message: `Tool "${tool}" uses MCP server "${server}", which this profile does not declare.`,
          remediation: `Declare "${server}" beneath mcp-servers in this profile, or remove the tool.`,
        });
        continue;
      }
      if (!declared.has(operation)) {
        errors.push({
          file,
          invariant,
          message: `Tool "${tool}" is not listed in the "${server}" mcp-servers tools array.`,
          remediation: `Add "${operation}" to the "${server}" tools list, or remove the granted tool.`,
        });
      }
    }
  }

  return errors;
}
