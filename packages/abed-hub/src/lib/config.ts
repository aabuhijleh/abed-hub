import { readJson, toolFile, writeJson } from "@abed-hub/config";
import { z } from "zod";
import { type Component, isComponent, REMOVED } from "./registry";

const TOOL = "abed-hub";
const FILE = "config.json";

const Config = z.object({
  components: z.array(z.string()),
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
  if (!parsed.success) return null;
  // A name saved before a component was removed reads as its successors.
  return parsed.data.components.flatMap((name) =>
    isComponent(name) ? [name] : (REMOVED[name] ?? []),
  );
}

export async function writeSelection(components: Component[]): Promise<string> {
  return writeJson(TOOL, FILE, { components });
}
