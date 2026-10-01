import { homedir } from "node:os";
import path from "node:path";
import { capture } from "./exec";
import { parseFrontmatter, splitFrontmatter } from "./frontmatter";

/**
 * Every agent reads skills out of one store, with `~/.claude/skills/<name>`
 * and its siblings symlinked into it. The `skills` npm package owns both the
 * store and the lock file next to it.
 */
export const STORE = path.join(homedir(), ".agents", "skills");
const LOCK = path.join(homedir(), ".agents", ".skill-lock.json");

export interface LockEntry {
  source: string;
  sourceType: string;
  skillPath: string;
  /** Tree SHA of the skill's folder on the source repo's default branch. */
  skillFolderHash: string;
}

export async function readLock(): Promise<Map<string, LockEntry>> {
  const entries = new Map<string, LockEntry>();
  const file = Bun.file(LOCK);
  if (!(await file.exists())) return entries;

  try {
    const parsed = (await file.json()) as {
      skills?: Record<string, Partial<LockEntry>>;
    };
    for (const [name, entry] of Object.entries(parsed.skills ?? {})) {
      if (typeof entry?.skillFolderHash === "string") {
        entries.set(name, entry as LockEntry);
      }
    }
  } catch {
    // A lock file we cannot parse is the same as no lock file: every skill
    // reads as installed-but-unknown rather than the run dying here.
  }
  return entries;
}

export function skillFile(name: string, store = STORE): string {
  return path.join(store, name, "SKILL.md");
}

export async function isInstalled(name: string): Promise<boolean> {
  return await Bun.file(skillFile(name)).exists();
}

/**
 * Folder tree SHAs for every skill in one directory of one repo, which is the
 * same value the lock file records at install time. One call covers a whole
 * repo, so the caller groups by repo before asking.
 */
export async function remoteHashes(
  repo: string,
  dir: string,
): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  const { ok, stdout } = await capture([
    "gh",
    "api",
    `repos/${repo}/contents/${dir}`,
  ]);
  if (!ok) return hashes;

  try {
    const entries = JSON.parse(stdout) as {
      name?: unknown;
      sha?: unknown;
      type?: unknown;
    }[];
    for (const entry of entries) {
      if (entry.type !== "dir") continue;
      if (typeof entry.name === "string" && typeof entry.sha === "string") {
        hashes.set(entry.name, entry.sha);
      }
    }
  } catch {
    // No network, no auth, or a repo that moved. Skills fall back to
    // installed-but-unknown, which is what the report already says.
  }
  return hashes;
}

const DISABLE_KEY = /^disable-model-invocation\s*:/;
const DESCRIPTION_KEY = /^description\s*:/;

function frontmatter(text: string): Record<string, unknown> | null {
  const split = splitFrontmatter(text);
  return split ? parseFrontmatter(split.front) : null;
}

/** Whether a SKILL.md is model-invocable and carries the patched description. */
export function isPatched(text: string, description: string): boolean {
  const front = frontmatter(text);
  if (!front) return false;
  return (
    !("disable-model-invocation" in front) && front.description === description
  );
}

/** Drops `disable-model-invocation` and swaps the description; the body stays. */
export function applyPatch(text: string, patchedDescription: string): string {
  const front = splitFrontmatter(text)?.front;
  if (front === undefined || isPatched(text, patchedDescription)) return text;

  const description = `description: ${JSON.stringify(patchedDescription)}`;
  const kept: string[] = [];
  let skipping = false;
  for (const line of front.split("\n")) {
    if (skipping && /^\s/.test(line)) continue;
    skipping = false;
    if (DISABLE_KEY.test(line)) continue;
    if (DESCRIPTION_KEY.test(line)) {
      kept.push(description);
      skipping = true;
      continue;
    }
    kept.push(line);
  }
  if (!kept.includes(description)) kept.push(description);
  return text.replace(front, () => kept.join("\n"));
}

/** Null when not installed. Reads the file, since an undone patch keeps the lock hash. */
export async function needsPatch(
  name: string,
  description: string,
  store = STORE,
): Promise<boolean | null> {
  const file = Bun.file(skillFile(name, store));
  if (!(await file.exists())) return null;
  return !isPatched(await file.text(), description);
}

export async function patchSkill(
  name: string,
  description: string,
  store = STORE,
): Promise<void> {
  const target = skillFile(name, store);
  const text = await Bun.file(target).text();
  const patched = applyPatch(text, description);
  if (patched !== text) await Bun.write(target, patched);
}
