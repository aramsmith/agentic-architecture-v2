import { createInterface } from "node:readline";

/**
 * Reads a line without echoing it. The passphrase must not appear on screen, in
 * scrollback, or in a terminal recording, because it is the only secret that an
 * agent sharing this machine cannot already read.
 */
export async function readSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error(
      "A passphrase can only be entered interactively. Run this command yourself in a terminal, never through an agent.",
    );
  }

  const input = process.stdin;
  const output = process.stdout;
  const rl = createInterface({ input, output, terminal: true });

  return new Promise<string>((resolve, reject) => {
    output.write(prompt);
    let muted = true;
    const originalWrite = output.write.bind(output);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (output as any).write = (chunk: unknown, ...rest: unknown[]): boolean => {
      if (muted && typeof chunk === "string" && !chunk.includes("\n")) {
        return true;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalWrite as any)(chunk, ...rest);
    };

    const restore = (): void => {
      muted = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (output as any).write = originalWrite;
      rl.close();
    };

    rl.question("", (answer) => {
      restore();
      output.write("\n");
      resolve(answer);
    });
    rl.on("error", (error) => {
      restore();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

export async function readLine(prompt: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await new Promise<string>((resolve) => {
      rl.question(prompt, resolve);
    });
  } finally {
    rl.close();
  }
}
