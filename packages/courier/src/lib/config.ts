import { readJson, toolFile, writeJson } from "@abed-hub/config";
import type { z } from "zod";

/**
 * One config file, split into a section per tool:
 *
 *   { "jira": { ATLASSIAN_… }, "slack": { SLACK_… } }
 *
 * It holds API tokens, so @abed-hub/config writes it 0600 in a 0700 directory.
 */
const TOOL = "courier";
const FILE = "config.json";

type RawConfig = Record<string, unknown>;

export function getConfigPath(): string {
  return toolFile(TOOL, FILE);
}

/** The whole file, or `{}` when it is missing or unparseable. */
async function readRaw(): Promise<RawConfig> {
  return (await readJson<RawConfig>(TOOL, FILE)) ?? {};
}

/** One tool's section, or null when absent or invalid. */
export async function readSection<T>(
  section: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const raw = await readRaw();
  const parsed = schema.safeParse(raw[section]);
  return parsed.success ? parsed.data : null;
}

/** Replace one tool's section, leaving every other section untouched. */
export async function writeSection<T>(
  section: string,
  value: T,
): Promise<void> {
  const raw = await readRaw();
  await writeJson(TOOL, FILE, { ...raw, [section]: value });
}

export { maskSecret as maskToken } from "@abed-hub/config";
