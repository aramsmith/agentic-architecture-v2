import { readFile } from "node:fs/promises";

import { parseDocument } from "yaml";

import type { ValidationError } from "../types.js";

export interface ProfileFrontmatter {
  name: string;
  description: string;
  model?: string;
  tools?: string[];
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
}

export interface ParsedProfile {
  file: string;
  frontmatter?: ProfileFrontmatter;
  errors: ValidationError[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  data: Record<string, unknown>,
  field: string,
  file: string,
  errors: ValidationError[],
): string | undefined {
  const value = data[field];
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  errors.push({
    file,
    invariant: "profile-frontmatter",
    message: `Frontmatter field "${field}" must be a non-empty string.`,
    remediation: `Add a non-empty ${field} field to the YAML frontmatter.`,
  });
  return undefined;
}

function optionalBoolean(
  data: Record<string, unknown>,
  field: string,
  file: string,
  errors: ValidationError[],
): boolean | undefined {
  const value = data[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }

  errors.push({
    file,
    invariant: "profile-frontmatter",
    message: `Frontmatter field "${field}" must be true or false.`,
    remediation: `Set ${field} to a YAML boolean.`,
  });
  return undefined;
}

export async function parseProfile(
  absolutePath: string,
  file: string,
  kind: "agent" | "skill",
): Promise<ParsedProfile> {
  const content = await readFile(absolutePath, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(content);
  const errors: ValidationError[] = [];

  if (!match?.[1]) {
    return {
      file,
      errors: [
        {
          file,
          invariant: "profile-frontmatter",
          message: "The file must start with YAML frontmatter delimited by --- lines.",
          remediation: "Add valid YAML frontmatter at the start of the file.",
        },
      ],
    };
  }

  const document = parseDocument(match[1], { prettyErrors: false });
  if (document.errors.length > 0) {
    return {
      file,
      errors: document.errors.map((error) => ({
        file,
        invariant: "profile-frontmatter",
        message: `Invalid YAML frontmatter: ${error.message}`,
        remediation: "Correct the YAML syntax at the start of the file.",
      })),
    };
  }
  const parsed: unknown = document.toJS();
  if (!isRecord(parsed)) {
    return {
      file,
      errors: [
        {
          file,
          invariant: "profile-frontmatter",
          message: "YAML frontmatter must be a mapping of fields to values.",
          remediation: "Replace the frontmatter with a YAML mapping.",
        },
      ],
    };
  }

  const name = requiredString(parsed, "name", file, errors);
  const description = requiredString(parsed, "description", file, errors);
  const allowedFields =
    kind === "skill"
      ? new Set(["name", "description"])
      : new Set([
          "name",
          "description",
          "model",
          "tools",
          "user-invocable",
          "disable-model-invocation",
          "mcp-servers",
        ]);
  for (const field of Object.keys(parsed)) {
    if (!allowedFields.has(field)) {
      errors.push({
        file,
        invariant: "profile-frontmatter",
        message: `Frontmatter field "${field}" is not supported for an AFF ${kind}.`,
        remediation: "Remove the field or use a supported GitHub Copilot frontmatter key.",
      });
    }
  }

  if (kind === "skill") {
    return name && description
      ? { file, frontmatter: { name, description }, errors }
      : { file, errors };
  }

  const model = requiredString(parsed, "model", file, errors);
  if (
    parsed["mcp-servers"] !== undefined &&
    !isRecord(parsed["mcp-servers"])
  ) {
    errors.push({
      file,
      invariant: "profile-frontmatter",
      message: 'Optional field "mcp-servers" must be a YAML mapping.',
      remediation: "Define named MCP server configurations beneath mcp-servers.",
    });
  }
  const tools = parsed.tools;
  if (
    !Array.isArray(tools) ||
    tools.length === 0 ||
    !tools.every((tool) => typeof tool === "string" && tool !== "")
  ) {
    errors.push({
      file,
      invariant: "profile-frontmatter",
      message: 'Frontmatter field "tools" must be a non-empty string array.',
      remediation: "List the supported tool names in the tools array.",
    });
  }

  const userInvocable = optionalBoolean(
    parsed,
    "user-invocable",
    file,
    errors,
  );
  const disableModelInvocation = optionalBoolean(
    parsed,
    "disable-model-invocation",
    file,
    errors,
  );

  if (userInvocable === undefined) {
    errors.push({
      file,
      invariant: "profile-frontmatter",
      message: 'Required field "user-invocable" is missing.',
      remediation: "Set user-invocable explicitly to true or false.",
    });
  }
  if (disableModelInvocation === undefined) {
    errors.push({
      file,
      invariant: "profile-frontmatter",
      message: 'Required field "disable-model-invocation" is missing.',
      remediation: "Set disable-model-invocation explicitly to true or false.",
    });
  }

  if (
    !name ||
    !description ||
    !model ||
    !Array.isArray(tools) ||
    !tools.every((tool) => typeof tool === "string") ||
    userInvocable === undefined ||
    disableModelInvocation === undefined
  ) {
    return { file, errors };
  }

  return {
    file,
    frontmatter: {
      name,
      description,
      model,
      tools,
      userInvocable,
      disableModelInvocation,
    },
    errors,
  };
}
