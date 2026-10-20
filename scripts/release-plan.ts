/**
 * Work out which packages a push to main should release, and hand the list to
 * the workflow as a job matrix.
 *
 * The whole release ritual is bumping a version in package.json. This diffs the
 * tree against npm's `latest` and stages only what moved, which is the same
 * check `abed-hub doctor` runs against a developer's machine. A version whose
 * release tag exists is already staged, so it waits for approval instead.
 *
 * Run it by hand with `bun run release:plan` to see what the next push would do.
 */
import { appendFileSync } from "node:fs";
import { releaseTag } from "./lib/notes";
import {
  planReleases,
  publishablePackages,
  publishedVersions,
} from "./lib/workspace";

const root = `${import.meta.dir}/..`;

const packages = await publishablePackages(root);
const tags = new Set(
  (await Bun.$`git ls-remote --tags --refs origin`.cwd(root).text())
    .split("\n")
    .map((line) => line.split("refs/tags/")[1])
    .filter(Boolean),
);
const tagged = new Set(
  packages
    .filter((pkg) => tags.has(releaseTag(pkg.name, pkg.version)))
    .map((pkg) => pkg.name),
);
const plan = planReleases(packages, await publishedVersions(packages), tagged);

const width = Math.max(...plan.map((entry) => entry.name.length));
for (const entry of plan) {
  const from = entry.published ?? "not on npm";
  const arrow =
    entry.verdict === "release" || entry.verdict === "staged"
      ? `${from} -> `
      : "";
  console.log(
    `${entry.verdict.padEnd(11)} ${entry.name.padEnd(width)}  ${arrow}${entry.version}`,
  );
}

for (const entry of plan) {
  if (entry.verdict === "unpublished") {
    warn(
      `${entry.name} is not on npm`,
      `Staged publishing cannot create a package. Publish ${entry.name}@${entry.version} once by hand, then this workflow takes over.`,
    );
  }
  if (entry.verdict === "ahead") {
    warn(
      `${entry.name} is behind npm`,
      `npm has ${entry.published}, the tree has ${entry.version}. Someone published outside this workflow.`,
    );
  }
}

const releasing = plan.filter((entry) => entry.verdict === "release");
const matrix = releasing.map(({ name, dir, version }) => ({
  name,
  dir,
  version,
}));

console.log(
  releasing.length === 0
    ? "\nNothing to release."
    : `\nStaging ${releasing.map((entry) => `${entry.name}@${entry.version}`).join(", ")}.`,
);

const output = process.env.GITHUB_OUTPUT;
if (output) {
  appendFileSync(
    output,
    `any=${releasing.length > 0}\nmatrix=${JSON.stringify(matrix)}\n`,
  );
}

/** A GitHub Actions annotation, which shows on the run summary, not just the log. */
function warn(title: string, message: string): void {
  console.log(`::warning title=${title}::${message}`);
}
