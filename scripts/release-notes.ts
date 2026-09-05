/**
 * Tag a staged release and open a GitHub Release for it.
 *
 * Runs once per package in the stage matrix, straight after `npm stage publish`,
 * so a failed publish never leaves a release behind. `gh release create` cuts
 * the tag itself at the SHA that built the tarball, which means no git identity
 * and no tag push here.
 *
 * bun run scripts/release-notes.ts <package> <dir> <version> <sha> [--dry-run]
 *
 * `--dry-run` prints the notes and the gh command and touches nothing.
 */
import { notesBody, previousTag, releaseTag, shortName } from "./lib/notes";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const [pkg, dir, version, sha] = argv.filter((arg) => arg !== "--dry-run");
if (!pkg || !dir || !version || !sha) {
  console.error("usage: release-notes.ts <package> <dir> <version> <sha>");
  process.exit(2);
}

const tag = releaseTag(pkg, version);
const previous = previousTag(await tags(), pkg, version);

const range = previous ? `${previous}..${sha}` : sha;
const log = await git([
  "log",
  "--no-merges",
  "--format=- %h %s",
  range,
  "--",
  dir,
]);
const commits = log.split("\n").filter(Boolean);

const body = notesBody({ pkg, dir, version, commits, previous });
console.log(body);

const args = [
  "gh",
  "release",
  "create",
  tag,
  "--target",
  sha,
  "--title",
  `${shortName(pkg)} ${version}`,
  "--notes",
  body,
  // Prepends the block above to GitHub's PR-linked list for the same range.
  "--generate-notes",
];
if (previous) args.push("--notes-start-tag", previous);

if (dryRun) {
  console.log(`\n--- would run ---\n${args.slice(0, -2).join(" ")} ...`);
  process.exit(0);
}

const created = Bun.spawn(args, { stdout: "inherit", stderr: "inherit" });
process.exit(await created.exited);

async function git(argv: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...argv], { stdout: "pipe", stderr: "pipe" });
  const [out, code] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`git ${argv[0]} exited ${code}`);
  return out.trim();
}

/** Every tag the checkout knows about. Needs fetch-depth: 0 to be complete. */
async function tags(): Promise<string[]> {
  return (await git(["tag", "--list"])).split("\n").filter(Boolean);
}
