import { createHash, createPublicKey, generateKeyPairSync } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import writeFileAtomic from "write-file-atomic";

export const identityDirectoryName = path.join(".aff", "identity");
export const privateKeyFileName = "architect.key";
export const publicKeyFileName = "architect.pub";

export interface ArchitectIdentity {
  label: string;
  publicKeyPem: string;
  fingerprint: string;
  requireSignedApprovals: boolean;
}

export class IdentityError extends Error {
  public constructor(
    message: string,
    public readonly remediation: string,
  ) {
    super(`${message} Fix: ${remediation}`);
    this.name = "IdentityError";
  }
}

export function identityDirectory(home = homedir()): string {
  return path.join(home, identityDirectoryName);
}

/**
 * Lower-case SHA-256 over the DER/SPKI encoding of the public key. It identifies
 * the key without revealing anything the public key does not already reveal, and
 * matches the hexadecimal convention used by artifact bindings.
 */
export function fingerprintPublicKey(publicKeyPem: string): string {
  let der: Buffer;
  try {
    der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  } catch {
    throw new IdentityError(
      "The approval public key is not a readable SPKI public key.",
      "Regenerate the architect identity with the identity command.",
    );
  }
  return createHash("sha256").update(der).digest("hex");
}

export interface CreatedIdentity extends ArchitectIdentity {
  privateKeyPath: string;
  publicKeyPath: string;
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await stat(candidate);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function createIdentity(options: {
  label: string;
  passphrase: string;
  home?: string;
}): Promise<CreatedIdentity> {
  const label = options.label.trim();
  if (label === "") {
    throw new IdentityError(
      "The approver label must not be empty.",
      "Give the key a label such as a role, optionally with a name.",
    );
  }
  if (options.passphrase.length < 12) {
    throw new IdentityError(
      "The approval passphrase must be at least 12 characters.",
      "Choose a passphrase you can remember and will never write down.",
    );
  }

  const directory = identityDirectory(options.home);
  const privateKeyPath = path.join(directory, privateKeyFileName);
  const publicKeyPath = path.join(directory, publicKeyFileName);
  if (await pathExists(privateKeyPath)) {
    throw new IdentityError(
      `An architect identity already exists at ${privateKeyPath}.`,
      "Approvals bind to a key fingerprint. Move the existing key aside deliberately and record the rotation before creating another.",
    );
  }

  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase: options.passphrase,
    },
  });

  await mkdir(directory, { recursive: true });
  await writeFileAtomic(privateKeyPath, privateKey, {
    encoding: "utf8",
    mode: 0o600,
  });
  await writeFileAtomic(
    publicKeyPath,
    `${JSON.stringify({ label, publicKeyPem: publicKey, requireSignedApprovals: true }, null, 2)}\n`,
    { encoding: "utf8" },
  );

  return {
    label,
    publicKeyPem: publicKey,
    fingerprint: fingerprintPublicKey(publicKey),
    requireSignedApprovals: true,
    privateKeyPath,
    publicKeyPath,
  };
}

export async function readIdentity(
  home?: string,
): Promise<ArchitectIdentity | undefined> {
  const publicKeyPath = path.join(identityDirectory(home), publicKeyFileName);
  let content: string;
  try {
    content = await readFile(publicKeyPath, "utf8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new IdentityError(
      `The architect public key at ${publicKeyPath} is not readable JSON.`,
      "Restore the file, or create a new identity and record the rotation.",
    );
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("label" in parsed) ||
    !("publicKeyPem" in parsed) ||
    typeof parsed.label !== "string" ||
    typeof parsed.publicKeyPem !== "string"
  ) {
    throw new IdentityError(
      `The architect public key at ${publicKeyPath} is missing its label or key.`,
      "Restore the file, or create a new identity and record the rotation.",
    );
  }

  return {
    label: parsed.label,
    publicKeyPem: parsed.publicKeyPem,
    fingerprint: fingerprintPublicKey(parsed.publicKeyPem),
    // Holding a key means approvals are expected to carry it. An absent setting
    // is read as the stricter value so a truncated file cannot quietly relax the
    // policy on this machine.
    requireSignedApprovals:
      "requireSignedApprovals" in parsed
        ? parsed.requireSignedApprovals !== false
        : true,
  };
}

export async function readEncryptedPrivateKey(home?: string): Promise<string> {
  const privateKeyPath = path.join(identityDirectory(home), privateKeyFileName);
  try {
    return await readFile(privateKeyPath, "utf8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new IdentityError(
        `No architect identity exists at ${privateKeyPath}.`,
        "Create the architect identity once before approving a phase.",
      );
    }
    throw error;
  }
}
