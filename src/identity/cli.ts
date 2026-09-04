#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { Command, CommanderError } from "commander";

import { createIdentity, IdentityError, readIdentity } from "./keys.js";
import { readLine, readSecret } from "./prompt.js";

export async function runIdentityCli(argv: string[]): Promise<number> {
  const program = new Command();
  program
    .name("aff-identity")
    .description(
      "Create the architect approval identity used to sign human decisions.",
    )
    .option("--label <label>", "approver label bound to the key")
    .exitOverride();

  try {
    program.parse(argv);
  } catch (error: unknown) {
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? 0 : 64;
    }
    throw error;
  }

  const options = program.opts<{ label?: string }>();

  try {
    const existing = await readIdentity();
    if (existing) {
      console.error(
        `ERROR [identity-exists] An architect identity already exists.\n  Label: ${existing.label}\n  Fingerprint: ${existing.fingerprint}\n  Fix: Approvals bind to this fingerprint. Move the key aside deliberately and record a rotation before creating another.`,
      );
      return 1;
    }

    console.log(
      "This creates the key that signs your phase approvals.\n" +
        "The label travels with every decision you sign. A role such as\n" +
        '"Accountable architect" keeps a personal name out of case folders.\n',
    );
    const label =
      options.label ?? (await readLine("Approver label: ")).trim();

    console.log(
      "\nThe passphrase protects the key. It is never stored, never written to\n" +
        "disk, and cannot be recovered or reset. Never type it into an agent\n" +
        "conversation: an agent that asks for it is phishing you.\n",
    );
    const passphrase = await readSecret("Passphrase: ");
    const confirmation = await readSecret("Confirm passphrase: ");
    if (passphrase !== confirmation) {
      console.error(
        "ERROR [passphrase-mismatch] The passphrases do not match.\n  Fix: Run the command again.",
      );
      return 1;
    }

    const created = await createIdentity({ label, passphrase });
    console.log(
      `\nCreated  ${created.privateKeyPath}   (ENCRYPTED)\n` +
        `         ${created.publicKeyPath}\n` +
        `Label        ${created.label}\n` +
        `Fingerprint  ${created.fingerprint}\n\n` +
        "Keep the passphrase in your head. Losing it does not invalidate past\n" +
        "approvals, but you will need a recorded key rotation to sign new ones.",
    );
    return 0;
  } catch (error: unknown) {
    if (error instanceof IdentityError) {
      console.error(`ERROR [identity] ${error.message}`);
      return 1;
    }
    if (error instanceof Error) {
      console.error(`FATAL: ${error.message}`);
      return 2;
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runIdentityCli(process.argv)
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(
        `FATAL: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 2;
    });
}
