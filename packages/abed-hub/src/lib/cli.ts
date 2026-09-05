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
