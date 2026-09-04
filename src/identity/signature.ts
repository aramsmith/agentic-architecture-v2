import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

import { canonicalize } from "json-canonicalize";

import { isRecord } from "../common/json.js";
import { fingerprintPublicKey, IdentityError } from "./keys.js";

export const signatureAlgorithm = "ed25519";

export interface ApprovalSignature {
  algorithm: string;
  publicKeyPem: string;
  keyFingerprint: string;
  value: string;
}

/**
 * The signed payload is the canonical JSON of the whole approval record with
 * only `extensions.signature` removed. Signing the artifact hashes alone would
 * leave the verdict, phase, approver, and decision time unprotected, so a valid
 * signature could be lifted onto a modified record.
 */
export function signablePayload(record: Record<string, unknown>): Buffer {
  const extensions = isRecord(record.extensions)
    ? Object.fromEntries(
        Object.entries(record.extensions).filter(([key]) => key !== "signature"),
      )
    : undefined;
  const payload: Record<string, unknown> = {
    ...record,
    ...(extensions ? { extensions } : {}),
  };
  return Buffer.from(canonicalize(payload), "utf8");
}

export function readSignature(
  record: Record<string, unknown>,
): ApprovalSignature | undefined {
  if (!isRecord(record.extensions) || !isRecord(record.extensions.signature)) {
    return undefined;
  }
  const candidate = record.extensions.signature;
  if (
    typeof candidate.algorithm !== "string" ||
    typeof candidate.publicKeyPem !== "string" ||
    typeof candidate.keyFingerprint !== "string" ||
    typeof candidate.value !== "string"
  ) {
    return undefined;
  }
  return {
    algorithm: candidate.algorithm,
    publicKeyPem: candidate.publicKeyPem,
    keyFingerprint: candidate.keyFingerprint,
    value: candidate.value,
  };
}

export interface VerificationResult {
  verified: boolean;
  reason?: string;
}

export function verifyApprovalSignature(
  record: Record<string, unknown>,
): VerificationResult {
  const signature = readSignature(record);
  if (!signature) {
    return { verified: false, reason: "no signature is recorded" };
  }
  if (signature.algorithm !== signatureAlgorithm) {
    return {
      verified: false,
      reason: `algorithm "${signature.algorithm}" is not supported`,
    };
  }

  let publicKey: ReturnType<typeof createPublicKey>;
  try {
    publicKey = createPublicKey(signature.publicKeyPem);
  } catch {
    return { verified: false, reason: "the embedded public key is unreadable" };
  }

  let actualFingerprint: string;
  try {
    actualFingerprint = fingerprintPublicKey(signature.publicKeyPem);
  } catch {
    return { verified: false, reason: "the embedded public key is unreadable" };
  }
  if (actualFingerprint !== signature.keyFingerprint) {
    return {
      verified: false,
      reason: "the recorded fingerprint does not match the embedded public key",
    };
  }

  let signatureBytes: Buffer;
  try {
    signatureBytes = Buffer.from(signature.value, "base64");
  } catch {
    return { verified: false, reason: "the signature is not valid base64" };
  }

  const valid = verify(
    null,
    signablePayload(record),
    publicKey,
    signatureBytes,
  );
  return valid
    ? { verified: true }
    : { verified: false, reason: "the signature does not match the record" };
}

export function signApproval(
  record: Record<string, unknown>,
  encryptedPrivateKeyPem: string,
  passphrase: string,
  publicKeyPem: string,
): Record<string, unknown> {
  let privateKey: ReturnType<typeof createPrivateKey>;
  try {
    privateKey = createPrivateKey({
      key: encryptedPrivateKeyPem,
      passphrase,
    });
  } catch {
    throw new IdentityError(
      "The approval key could not be unlocked with that passphrase.",
      "Re-enter the passphrase. It is never stored, so it cannot be recovered or reset.",
    );
  }

  const fingerprint = fingerprintPublicKey(publicKeyPem);
  const extensions = isRecord(record.extensions) ? record.extensions : {};
  const unsigned: Record<string, unknown> = {
    ...record,
    extensions: {
      ...extensions,
      approvalMode: "human-verified",
      keyFingerprint: fingerprint,
    },
  };

  const value = sign(null, signablePayload(unsigned), privateKey).toString(
    "base64",
  );

  return {
    ...unsigned,
    extensions: {
      ...(unsigned.extensions as Record<string, unknown>),
      signature: {
        algorithm: signatureAlgorithm,
        publicKeyPem,
        keyFingerprint: fingerprint,
        value,
      },
    },
  };
}
