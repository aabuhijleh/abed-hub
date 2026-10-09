import { splitFrontmatter } from "../../packages/abed-hub/src/lib/frontmatter";

/**
 * A skill copied from upstream and kept in step with it. The local frontmatter is
 * ours and never synced. The body is upstream's with `patches` applied, nothing else.
 */
export interface Fork {
  /** The directory under `skills/`. */
  skill: string;
  /** `owner/repo` on GitHub. */
  repo: string;
  /** The upstream SKILL.md, relative to the repo root. */
  path: string;
  /** Exact replacements on upstream's body, each of which must match once. */
  patches: Patch[];
}

export interface Patch {
  find: string;
  replace: string;
}

export const FORKS: Fork[] = [
  {
    skill: "deslop",
    repo: "cursor/plugins",
    path: "pstack/skills/unslop/SKILL.md",
    patches: [
      { find: "\n# Unslop\n", replace: "\n# Deslop\n" },
      {
        find: "spell out arrows and abbreviations.\n",
        replace:
          "spell out arrows and abbreviations.\n" +
          '34. **ASD-STE100 Simplified Technical English.** Follow STE where it makes the text clearer. Keep an instruction to about 20 words and a description to about 25. Write one action per step, in the imperative. Use the simple present and past tenses. Use each verb in its literal sense: "cut a tag" becomes "create a tag", "hand-cut the release" becomes "create the release manually". Break a noun cluster longer than three words: "session token refresh handler" becomes "the handler that refreshes the session token". Keep code, product names, and the reader\'s own terms as they are.\n',
      },
    ],
  },
];

/** CREDITS.md links the upstream file at the commit the copy was taken from. */
const PINNED_LINK = /\[`([0-9a-f]{7,40})`\]\(([^)]*\/blob\/)([0-9a-f]{40})\//;

function split(text: string, label: string): { front: string; body: string } {
  const parts = splitFrontmatter(text);
  if (!parts) throw new Error(`${label} has no frontmatter`);
  return parts;
}

/** Upstream's body with every patch applied. Throws when a patch no longer fits. */
export function patchedBody(fork: Fork, upstream: string): string {
  let body = split(upstream, `upstream ${fork.path}`).body;
  for (const { find, replace } of fork.patches) {
    const count = body.split(find).length - 1;
    if (count !== 1) {
      throw new Error(
        `${fork.skill}: patch ${JSON.stringify(find)} matches ${count} times upstream, not once. Update it in scripts/lib/forks.ts`,
      );
    }
    body = body.replace(find, () => replace);
  }
  return body;
}

/** The local SKILL.md with its own frontmatter and upstream's patched body. */
export function rebuild(fork: Fork, local: string, upstream: string): string {
  const { front } = split(local, `skills/${fork.skill}/SKILL.md`);
  return `---\n${front}\n---\n${patchedBody(fork, upstream)}`;
}

/** Whether the local body is exactly upstream's plus the patches. */
export function bodyMatches(
  fork: Fork,
  local: string,
  upstream: string,
): boolean {
  return (
    split(local, `skills/${fork.skill}/SKILL.md`).body ===
    patchedBody(fork, upstream)
  );
}

/** `write` is a plain sync, `stage` the pre-commit hook, `check` CI. */
export type SyncMode = "write" | "stage" | "check";

/**
 * What a sync does with one fork. A plain sync rewrites a body that differs from
 * upstream plus the patches, which is how a new patch lands. The hook and CI refuse it.
 */
export function syncAction(
  mode: SyncMode,
  bodyInStep: boolean,
  upstreamMoved: boolean,
): "in-step" | "edited" | "behind" | "write" {
  if (!bodyInStep && mode !== "write") return "edited";
  if (bodyInStep && !upstreamMoved) return "in-step";
  if (mode === "check") return "behind";
  return "write";
}

export function frontmatterOf(text: string): string {
  return split(text, "SKILL.md").front;
}

/** The full commit sha CREDITS.md pins. */
export function pinnedCommit(credits: string): string {
  const match = PINNED_LINK.exec(credits);
  if (!match?.[3]) {
    throw new Error(
      "CREDITS.md does not link the upstream file at a full commit sha",
    );
  }
  return match[3];
}

/** CREDITS.md with its pinned link moved to `sha`. */
export function repin(credits: string, sha: string): string {
  pinnedCommit(credits);
  return credits.replace(
    PINNED_LINK,
    (_, _short, prefix: string) => `[\`${sha.slice(0, 7)}\`](${prefix}${sha}/`,
  );
}
