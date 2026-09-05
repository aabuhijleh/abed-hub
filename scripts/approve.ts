/**
 * Walk everything sitting in npm's staging queue and decide each one.
 *
 * CI stages over OIDC without 2FA, which is the point: nothing it publishes is
 * public until a human approves it here. `npm stage approve` asks for the second
 * factor itself, so its terminal is handed straight through.
 *
 * `bun run approve`, or `--dry-run` to see the decisions without sending them.
 */
import * as p from "@clack/prompts";
import {
  age,
  fromAutomation,
  parseStaged,
  type StagedVersion,
} from "./lib/staged";
import { latestVersion } from "./lib/workspace";

const dryRun = process.argv.includes("--dry-run");

p.intro(`abed-hub approve${dryRun ? " (dry run)" : ""}`);

const s = p.spinner();
s.start("Reading npm's staging queue");

const listed = await run(["npm", "stage", "list", "--json"]);
if (!listed.ok) {
  s.stop("Could not read the queue");
  p.log.error(listed.stderr.trim() || "npm stage list failed");
  if (/unknown command|Unknown command/.test(listed.stderr)) {
    p.log.info(
      "npm stage arrived in 11.15.0. Upgrade: npm install --global npm@latest",
    );
  }
  process.exit(1);
}

const staged = parseStaged(listed.stdout).filter(
  (entry) => entry.status === "staged",
);

if (staged.length === 0) {
  s.stop("Queue is empty");
  p.outro("Nothing is waiting. Merge a version bump and CI will stage one.");
  process.exit(0);
}

const live = new Map<string, string | null>();
for (const name of new Set(staged.map((entry) => entry.packageName))) {
  live.set(name, await latestVersion(name).catch(() => null));
}
s.stop(`${staged.length} waiting`);

for (const entry of staged) {
  p.log.message(describe(entry, live.get(entry.packageName) ?? null));
}

const approved: string[] = [];
const rejected: string[] = [];
const skipped: string[] = [];

for (const entry of staged) {
  const label = `${entry.packageName}@${entry.version}`;

  const choice = await p.select({
    message: `${label}?`,
    options: [
      { value: "skip", label: "Skip", hint: "leave it in the queue" },
      {
        value: "approve",
        label: "Approve",
        hint: `publish it as ${entry.tag}`,
      },
      { value: "reject", label: "Reject", hint: "discard the staged tarball" },
    ],
    initialValue: "skip",
  });
  if (p.isCancel(choice)) cancel();

  if (choice === "skip") {
    skipped.push(label);
    continue;
  }

  if (choice === "reject") {
    const sure = await p.confirm({
      message: `Discard ${label}? Getting it back means another CI run.`,
      initialValue: false,
    });
    if (p.isCancel(sure)) cancel();
    if (!sure) {
      skipped.push(label);
      continue;
    }
  }

  if (dryRun) {
    p.log.info(`would run: npm stage ${choice} ${entry.id}`);
    (choice === "approve" ? approved : rejected).push(label);
    continue;
  }

  // Inherited streams: approve prompts for the second factor on this terminal.
  const proc = Bun.spawn(["npm", "stage", choice, entry.id], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await proc.exited) !== 0) {
    p.log.error(`npm stage ${choice} failed for ${label}`);
    skipped.push(label);
    continue;
  }
  (choice === "approve" ? approved : rejected).push(label);
}

const parts = [
  approved.length > 0 ? `published ${approved.join(", ")}` : "",
  rejected.length > 0 ? `discarded ${rejected.join(", ")}` : "",
  skipped.length > 0 ? `left ${skipped.join(", ")} in the queue` : "",
].filter(Boolean);

p.outro(parts.length > 0 ? `${parts.join("; ")}.` : "Nothing changed.");

function describe(entry: StagedVersion, published: string | null): string {
  const move = `${published ?? "not on npm"} → ${entry.version}`;
  const lines = [
    `${entry.packageName}  ${move}`,
    `  tag ${entry.tag}, ${entry.access}, staged ${age(entry.createdAt)} by ${entry.actor}`,
    `  ${entry.shasum}`,
  ];
  if (!fromAutomation(entry)) {
    lines.push(
      `  ! staged by ${entry.actorType}, not CI. This repo releases from GitHub Actions.`,
    );
  }
  return lines.join("\n");
}

function cancel(): never {
  p.cancel("Cancelled. Anything undecided is still in the queue.");
  process.exit(0);
}

async function run(argv: string[]) {
  const [cmd, ...args] = argv as [string, ...string[]];
  const proc = Bun.spawn([cmd, ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { ok: code === 0, stdout, stderr };
}
