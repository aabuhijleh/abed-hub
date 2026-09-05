import { compareVersions } from "./workspace";

/** `@aabuhijleh/gh-attach` becomes `gh-attach`. */
export function shortName(pkg: string): string {
  const slash = pkg.indexOf("/");
  return slash === -1 ? pkg : pkg.slice(slash + 1);
}

/**
 * The git tag for one package's release, `gh-attach@0.2.0`.
 *
 * All three packages share the `@aabuhijleh` scope, so carrying it in every tag
 * would be noise. The name still has to be in there: three packages version
 * independently, and a bare `v0.2.0` could not say which one moved.
 */
export function releaseTag(pkg: string, version: string): string {
  return `${shortName(pkg)}@${version}`;
}

/**
 * The newest tag already cut for this package, or null on its first release.
 * This is what bounds both the commit list and GitHub's generated notes, so
 * each package's notes cover the range since its own last release rather than
 * since whatever else happened to ship.
 */
export function previousTag(
  tags: string[],
  pkg: string,
  version: string,
): string | null {
  const prefix = `${shortName(pkg)}@`;
  const mine = tags
    .filter((tag) => tag.startsWith(prefix))
    .map((tag) => tag.slice(prefix.length))
    .filter((found) => compareVersions(found, version) < 0)
    .sort(compareVersions);

  const newest = mine.at(-1);
  return newest ? `${prefix}${newest}` : null;
}

export interface NotesInput {
  pkg: string;
  /** `packages/gh-attach`. */
  dir: string;
  version: string;
  /** Commit lines touching `dir`, newest first, already formatted. */
  commits: string[];
  previous: string | null;
}

/**
 * The half of the release notes this repo writes. `gh release create` prepends
 * it to GitHub's generated notes, which list every PR in the range and cannot
 * tell which package a PR was about.
 */
export function notesBody({
  pkg,
  dir,
  version,
  commits,
  previous,
}: NotesInput): string {
  const range = previous
    ? `since ${previous}`
    : "up to this first tagged release";
  const changes =
    commits.length > 0
      ? commits.join("\n")
      : `_Nothing under \`${dir}\` changed ${range}._`;

  return [
    `## Changes in \`${dir}\` ${range}`,
    "",
    changes,
    "",
    `\u{1F4E6} [\`${pkg}@${version}\` on npm](https://www.npmjs.com/package/${pkg}/v/${version})`,
    "",
    "> CI staged this over OIDC rather than publishing it. It reaches npm's",
    "> `latest` tag once a maintainer approves it with 2FA, so if the version",
    "> above 404s, approval is still pending.",
    "",
  ].join("\n");
}
