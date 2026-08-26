import * as p from "@clack/prompts";
import { errorMessage } from "./utils";

export function cancel(message = "Cancelled"): never {
  p.cancel(message);
  process.exit(0);
}

export function fail(err: unknown): never {
  p.log.error(errorMessage(err));
  process.exit(1);
}

/** Spinner on stderr, so `--json` output stays pipeable. */
export function spinner() {
  return p.spinner({ output: process.stderr });
}

/** Prompt for a value, exiting on cancel. */
export async function prompt(
  options: Parameters<typeof p.text>[0],
): Promise<string> {
  const value = await p.text(options);
  if (p.isCancel(value)) cancel();
  return String(value);
}
