/**
 * Bring every forked skill up to its upstream's latest commit, keeping our
 * frontmatter and the patches in `lib/forks.ts`.
 *
 * `bun run skills:sync` writes the update, and rewrites a body that differs from
 * upstream plus the patches. `--stage` also stages the update, which the pre-commit
 * hook uses. `--check` writes nothing. Both exit 1 on a body edited outside a patch,
 * and `--check` also exits 1 when a fork is behind upstream.
 */
import path from "node:path";
import {
  bodyMatches,
  FORKS,
  type Fork,
  frontmatterOf,
  pinnedCommit,
  rebuild,
  repin,
  type SyncMode,
  syncAction,
} from "./lib/forks";

const stage = process.argv.includes("--stage");
const mode: SyncMode = process.argv.includes("--check")
  ? "check"
  : stage
    ? "stage"
    : "write";
const skills = path.join(import.meta.dir, "..", "skills");
const headers: Record<string, string> = process.env.GITHUB_TOKEN
  ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
  : {};

let failed = false;

for (const fork of FORKS) {
  const skillFile = Bun.file(path.join(skills, fork.skill, "SKILL.md"));
  const creditsFile = Bun.file(path.join(skills, fork.skill, "CREDITS.md"));
  const local = await skillFile.text();
  const credits = await creditsFile.text();

  const pinned = pinnedCommit(credits);
  let latest: string;
  let before: string;
  try {
    latest = await latestCommit(fork);
    before = await upstreamAt(fork, pinned);
  } catch (error) {
    if (!stage) throw error;
    console.log(
      `▲ ${fork.skill}: skipped, GitHub is unreachable. CI checks it`,
    );
    continue;
  }

  const action = syncAction(
    mode,
    bodyMatches(fork, local, before),
    latest !== pinned,
  );

  if (action === "edited") {
    console.log(
      `✖ ${fork.skill}: the body differs from upstream ${short(pinned)} plus the patches. Move the edit into scripts/lib/forks.ts and run bun run skills:sync`,
    );
    failed = true;
    continue;
  }

  if (action === "in-step") {
    console.log(`✔ ${fork.skill}: in step with ${fork.repo}@${short(pinned)}`);
    continue;
  }

  if (action === "behind") {
    console.log(
      `✖ ${fork.skill}: upstream moved ${short(pinned)} -> ${short(latest)}. Run bun run skills:sync`,
    );
    failed = true;
    continue;
  }

  if (latest === pinned) {
    await Bun.write(skillFile, rebuild(fork, local, before));
    console.log(
      `↻ ${fork.skill}: rewrote the body from ${fork.repo}@${short(pinned)} plus the patches`,
    );
    continue;
  }

  const after = await upstreamAt(fork, latest);
  await Bun.write(skillFile, rebuild(fork, local, after));
  await Bun.write(creditsFile, repin(credits, latest));
  if (stage) await Bun.$`git add ${skillFile.name} ${creditsFile.name}`;
  console.log(`↑ ${fork.skill}: ${short(pinned)} -> ${short(latest)}`);

  if (frontmatterOf(before) !== frontmatterOf(after)) {
    console.log(
      `▲ ${fork.skill}: upstream changed its frontmatter, which ours replaces. Review it:\n` +
        `  https://github.com/${fork.repo}/compare/${pinned}...${latest}`,
    );
  }
}

if (failed) process.exit(1);

async function latestCommit(fork: Fork): Promise<string> {
  const url = `https://api.github.com/repos/${fork.repo}/commits?path=${encodeURIComponent(fork.path)}&per_page=1`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  const [commit] = (await response.json()) as { sha: string }[];
  if (!commit) throw new Error(`${fork.repo} has no commits on ${fork.path}`);
  return commit.sha;
}

async function upstreamAt(fork: Fork, sha: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${fork.repo}/${sha}/${fork.path}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  return response.text();
}

function short(sha: string): string {
  return sha.slice(0, 7);
}
