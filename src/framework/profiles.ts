import path from "node:path";

import fg from "fast-glob";

import { toRepositoryPath } from "../common/path.js";
import type {
  LifecycleManifest,
  ValidationError,
} from "../types.js";
import {
  parseProfile,
  type ParsedProfile,
} from "./frontmatter.js";

const allowedAgentDocuments = new Set([
  ".github/agents/AFF-OPERATING-CONTRACT.md",
]);

async function discoverProfiles(
  repositoryRoot: string,
): Promise<{ profiles: ParsedProfile[]; errors: ValidationError[] }> {
  const agentDocuments = await fg(".github/agents/**/*.md", {
    cwd: repositoryRoot,
    onlyFiles: true,
  });
  const skillDocuments = await fg(".github/skills/**/SKILL.md", {
    cwd: repositoryRoot,
    onlyFiles: true,
  });
  const errors: ValidationError[] = [];
  const skillMarkdown = await fg(".github/skills/**/*.md", {
    cwd: repositoryRoot,
    onlyFiles: true,
  });

  for (const agentDocument of agentDocuments) {
    const file = toRepositoryPath(agentDocument);
    if (!file.endsWith(".agent.md") && !allowedAgentDocuments.has(file)) {
      errors.push({
        file,
        invariant: "supported-profile-location",
        message: "Agent profiles must use .github/agents/<name>.agent.md.",
        remediation:
          "Rename the profile to the supported .agent.md filename or move non-profile documentation outside the agents directory.",
      });
    }

    for (const skillDocument of skillMarkdown) {
      const file = toRepositoryPath(skillDocument);
      const segments = file.split("/");
      if (
        path.posix.basename(file) !== "SKILL.md" ||
        segments.length !== 4
      ) {
        errors.push({
          file,
          invariant: "supported-profile-location",
          message: "Skill profiles must use .github/skills/<skill-name>/SKILL.md.",
          remediation:
            "Rename or move the skill profile to the supported SKILL.md location.",
        });
      }
    }
  }

  const agentProfiles = agentDocuments
    .map(toRepositoryPath)
    .filter((file) => file.endsWith(".md") && !allowedAgentDocuments.has(file));
  const profiles = await Promise.all([
    ...agentProfiles.map((file) =>
      parseProfile(path.join(repositoryRoot, file), file, "agent"),
    ),
    ...skillDocuments.map((skillDocument) => {
      const file = toRepositoryPath(skillDocument);
      return parseProfile(path.join(repositoryRoot, file), file, "skill");
    }),
  ]);

  return { profiles, errors };
}

function validateUniqueNames(profiles: ParsedProfile[]): ValidationError[] {
  const filesByName = new Map<string, string[]>();
  for (const profile of profiles) {
    if (!profile.frontmatter) {
      continue;
    }
    const files = filesByName.get(profile.frontmatter.name) ?? [];
    files.push(profile.file);
    filesByName.set(profile.frontmatter.name, files);
  }

  return [...filesByName.entries()].flatMap(([name, files]) =>
    files.length < 2
      ? []
      : files.map((file) => ({
          file,
          invariant: "unique-profile-name",
          message: `Profile name "${name}" is also declared by ${files.filter((candidate) => candidate !== file).join(", ")}.`,
          remediation: "Give every agent and skill a unique frontmatter name.",
        })),
  );
}

function validateNamesMatchLocations(
  profiles: ParsedProfile[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const profile of profiles) {
    const name = profile.frontmatter?.name;
    if (!name) {
      continue;
    }

    const expectedName = profile.file.endsWith(".agent.md")
      ? path.posix.basename(profile.file, ".agent.md")
      : path.posix.basename(path.posix.dirname(profile.file));
    if (name !== expectedName) {
      errors.push({
        file: profile.file,
        invariant: "profile-name-location",
        message: `Frontmatter name "${name}" does not match "${expectedName}" from the supported path.`,
        remediation: `Set name to "${expectedName}" or rename the file/directory consistently.`,
      });
    }
  }
  return errors;
}

function validateLifecycleProfiles(
  profiles: ParsedProfile[],
  lifecycle: LifecycleManifest,
): ValidationError[] {
  const agents = new Map(
    profiles.flatMap(({ file, frontmatter }) =>
      file.endsWith(".agent.md") && frontmatter
        ? [[frontmatter.name, { frontmatter, file }] as const]
        : [],
    ),
  );
  const errors: ValidationError[] = [];

  for (const owner of [...lifecycle.phases, ...lifecycle.reviewers]) {
    const profile = agents.get(owner.owner);
    if (!profile) {
      errors.push({
        file: ".github/agents/AFF-LIFECYCLE.json",
        invariant: "lifecycle-profile-consistency",
        message: `Lifecycle owner "${owner.owner}" has no matching agent profile.`,
        remediation: `Add .github/agents/${owner.owner}.agent.md with matching frontmatter.`,
      });
      continue;
    }

    if (profile.frontmatter.model !== owner.model) {
      errors.push({
        file: profile.file,
        invariant: "lifecycle-profile-consistency",
        message: `Profile model "${profile.frontmatter.model}" differs from lifecycle model "${owner.model}".`,
        remediation:
          "Update the profile, lifecycle manifest, operating contract, and README to the same approved model.",
      });
    }
  }

  return errors;
}

export async function validateProfiles(
  repositoryRoot: string,
  lifecycle: LifecycleManifest,
): Promise<ValidationError[]> {
  const { profiles, errors } = await discoverProfiles(repositoryRoot);

  return [
    ...errors,
    ...profiles.flatMap(({ errors: profileErrors }) => profileErrors),
    ...validateUniqueNames(profiles),
    ...validateNamesMatchLocations(profiles),
    ...validateLifecycleProfiles(profiles, lifecycle),
  ];
}
