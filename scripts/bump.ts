/**
 * Raise a package's version, which is the only thing a release needs from a
 * human. Merging the bump to main is what triggers the staging run.
 *
 * `bun run bump`
 */
import * as p from "@clack/prompts";
import {
  bumpVersion,
  type PlanEntry,
  planReleases,
  publishablePackages,
  publishedVersions,
} from "./lib/workspace";

const LEVELS = ["patch", "minor", "major"] as const;

const root = `${import.meta.dir}/..`;

p.intro("abed-hub bump");

const s = p.spinner();
s.start("Reading npm");
const packages = await publishablePackages(root);
const published = await publishedVersions(packages).catch((err: unknown) => {
  s.stop("Could not reach npm");
  p.log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
s.stop("Read npm");

const plan = planReleases(packages, published);

const picked = await p.multiselect({
  message: "Which packages are you releasing?",
  options: plan.map((entry) => ({
    value: entry,
    label: entry.name,
    hint: hintFor(entry),
  })),
  required: true,
});
if (p.isCancel(picked)) cancel();

const bumps: { entry: PlanEntry; version: string }[] = [];
for (const entry of picked) {
  const level = await p.select({
    message: `${entry.name} ${entry.version} becomes`,
    options: LEVELS.map((level) => ({
      value: level,
      label: `${bumpVersion(entry.version, level)}`,
      hint: level,
    })),
  });
  if (p.isCancel(level)) cancel();
  bumps.push({ entry, version: bumpVersion(entry.version, level) });
}

for (const { entry, version } of bumps) {
  const path = `${root}/${entry.dir}/package.json`;
  const manifest = await Bun.file(path).json();
  manifest.version = version;
  await Bun.write(path, `${JSON.stringify(manifest, null, 2)}\n`);
  p.log.success(`${entry.name} ${entry.version} -> ${version}`);
}

p.outro(
  "Commit the bump and merge it to main. The release workflow stages the rest.",
);

function hintFor(entry: PlanEntry): string {
  if (entry.verdict === "unpublished") return "not on npm yet";
  if (entry.verdict === "ahead") return `npm is ahead at ${entry.published}`;
  if (entry.verdict === "release") {
    return `${entry.published} on npm, bump already pending`;
  }
  return `${entry.published} on npm`;
}

function cancel(): never {
  p.cancel("Cancelled");
  process.exit(0);
}
