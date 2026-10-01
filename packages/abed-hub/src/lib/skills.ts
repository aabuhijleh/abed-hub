import { homedir } from "node:os";
import path from "node:path";
import { capture } from "./exec";

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

export function skillFile(name: string): string {
  return path.join(STORE, name, "SKILL.md");
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
