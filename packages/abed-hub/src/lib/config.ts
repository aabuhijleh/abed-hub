import { readJson, toolFile, writeJson } from "@abed-hub/config";
import { z } from "zod";
import { COMPONENTS, type Component } from "./registry";

const TOOL = "abed-hub";
const FILE = "config.json";

const Config = z.object({
  components: z.array(z.enum(COMPONENTS)),
});

export function configPath(): string {
  return toolFile(TOOL, FILE);
}

/**
 * What `setup` last installed. `doctor` and `update` work from this, so a
 * machine that only wanted courier is never nagged about chromium. Null until
 * setup has run once, which the callers read as "check everything".
 */
export async function readSelection(): Promise<Component[] | null> {
  const raw = await readJson(TOOL, FILE);
  if (raw === null) return null;
  const parsed = Config.safeParse(raw);
  return parsed.success ? parsed.data.components : null;
}

export async function writeSelection(components: Component[]): Promise<string> {
  return writeJson(TOOL, FILE, { components });
}
