import { maskSecret, readFile, toolFile } from "@abed-hub/config";
import type { Component, ConfigDep } from "./registry";
import { SELF_CONFIG, SPECS } from "./registry";

export type ConfigState =
  /** Parsed, with settings in it. */
  | "ok"
  /** Parsed to `{}`, so a setup command started it and wrote nothing. */
  | "empty"
  /** There, but not JSON this CLI can read. */
  | "unreadable"
  | "missing";

export interface ConfigReport {
  dep: ConfigDep;
  path: string;
  state: ConfigState;
  /** The settings, masked unless revealing. Null when there are none to show. */
  value: unknown;
  /** The file as it sits on disk, only for the unreadable case. */
  raw: string | null;
  /** Whether masking changed anything, so the outro can mention `--reveal`. */
  masked: boolean;
}

/**
 * Key names whose values are credentials. Every config file here is written by
 * a setup command, so the names are known, but matching on the name rather
 * than the file keeps a new secret from printing itself the day it is added.
 */
const SECRET_KEY = /token|secret|password|cookie|api[_-]?key/i;

export interface Masking {
  value: unknown;
  /** Whether anything was masked, so a caller can mention `--reveal`. */
  masked: boolean;
}

/** A copy of a parsed config with every credential shortened to its last 4. */
export function maskSecrets(input: unknown): Masking {
  if (Array.isArray(input)) {
    const parts = input.map(maskSecrets);
    return {
      value: parts.map((part) => part.value),
      masked: parts.some((part) => part.masked),
    };
  }
  if (typeof input !== "object" || input === null) {
    return { value: input, masked: false };
  }

  let masked = false;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEY.test(key) && typeof value === "string") {
      out[key] = maskSecret(value);
      masked = true;
      continue;
    }
    const child = maskSecrets(value);
    out[key] = child.value;
    masked ||= child.masked;
  }
  return { value: out, masked };
}

/** Every config file the selected components read, abed-hub's own first. */
export function configDeps(components: Component[]): ConfigDep[] {
  const deps = new Map<string, ConfigDep>();
  for (const dep of [
    SELF_CONFIG,
    ...components.flatMap((name) => SPECS[name].configs ?? []),
  ]) {
    deps.set(`${dep.tool}/${dep.file}`, dep);
  }
  return [...deps.values()];
}

export async function readConfig(
  dep: ConfigDep,
  { reveal }: { reveal: boolean },
): Promise<ConfigReport> {
  const path = toolFile(dep.tool, dep.file);
  const base = { dep, path, value: null, raw: null, masked: false };

  const text = await readFile(dep.tool, dep.file);
  if (text === null) return { ...base, state: "missing" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ...base, state: "unreadable", raw: text };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ...base, state: "unreadable", raw: text };
  }
  if (Object.keys(parsed).length === 0) {
    return { ...base, state: "empty" };
  }

  const { value, masked } = reveal
    ? { value: parsed, masked: false }
    : maskSecrets(parsed);
  return { ...base, state: "ok", value, masked };
}

export function readConfigs(
  components: Component[],
  options: { reveal: boolean },
): Promise<ConfigReport[]> {
  return Promise.all(
    configDeps(components).map((dep) => readConfig(dep, options)),
  );
}
