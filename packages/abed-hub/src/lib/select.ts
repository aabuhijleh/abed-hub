import * as p from "@clack/prompts";
import { cancel } from "./cli";
import { readSelection } from "./config";
import {
  COMPONENTS,
  type Component,
  expand,
  resolveAlias,
  SPECS,
} from "./registry";

function parseNames(raw: string[]): Component[] {
  const picked: Component[] = [];
  for (const value of raw) {
    const names = resolveAlias(value);
    if (!names) {
      throw new Error(
        `unknown component: ${value} (try: all, ${COMPONENTS.join(", ")})`,
      );
    }
    picked.push(...names);
  }
  return picked;
}

/**
 * Components named on the command line, else the ones `setup` last saved, else
 * all of them. `doctor` and `update` use this. Nothing prompts.
 */
export async function selected(
  raw: string[],
  all: boolean,
): Promise<Component[]> {
  if (all) return [...COMPONENTS];
  if (raw.length > 0) return expand(parseNames(raw));
  return expand((await readSelection()) ?? COMPONENTS);
}

/** What `setup` installs, which is the only place that asks. */
export async function choose(
  raw: string[],
  all: boolean,
): Promise<Component[]> {
  if (all) return [...COMPONENTS];
  if (raw.length > 0) return expand(parseNames(raw));

  const saved = await readSelection();
  if (!p.isTTY(process.stdout) || p.isCI()) return expand(saved ?? COMPONENTS);

  const picked = await p.multiselect({
    message: "What do you want installed?",
    options: COMPONENTS.map((name) => ({
      value: name,
      label: name,
      hint: SPECS[name].summary,
    })),
    initialValues: saved && saved.length > 0 ? saved : [...COMPONENTS],
    required: true,
  });
  if (p.isCancel(picked)) cancel();
  return expand(picked);
}
