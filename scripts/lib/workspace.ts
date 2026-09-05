import { Glob } from "bun";

export interface WorkspacePackage {
  /** The npm name, `@aabuhijleh/gh-attach`. */
  name: string;
  /** Directory relative to the repo root, `packages/gh-attach`. */
  dir: string;
  version: string;
}

interface Manifest {
  name?: unknown;
  version?: unknown;
  private?: unknown;
}

/**
 * Every workspace package that is meant to reach npm, sorted by name.
 *
 * `@abed-hub/config` is marked private and never ships: `bun build --target=bun`
 * inlines it into each bin, so the published tarballs carry its code without
 * depending on it. Anything else private drops out here for the same reason.
 */
export async function publishablePackages(
  root: string,
): Promise<WorkspacePackage[]> {
  const found: WorkspacePackage[] = [];

  for await (const match of new Glob("packages/*/package.json").scan(root)) {
    const dir = match.slice(0, -"/package.json".length);
    const manifest = (await Bun.file(`${root}/${match}`).json()) as Manifest;
    if (manifest.private === true) continue;
    if (typeof manifest.name !== "string") {
      throw new Error(`${match} has no name`);
    }
    if (typeof manifest.version !== "string") {
      throw new Error(`${manifest.name} has no version`);
    }
    found.push({ name: manifest.name, dir, version: manifest.version });
  }

  return found.sort((a, b) => a.name.localeCompare(b.name));
}

export type PlanVerdict =
  /** The tree is ahead of npm. This is the one that stages a tarball. */
  | "release"
  /** npm already has this version. */
  | "current"
  /** npm is ahead. Someone published outside this pipeline. */
  | "ahead"
  /** npm has never heard of the package, so there is nothing to stage onto. */
  | "unpublished";

export interface PlanEntry extends WorkspacePackage {
  /** The `latest` dist-tag on npm, or null when the package is not there. */
  published: string | null;
  verdict: PlanVerdict;
}

/**
 * Decide what a push to main should release, by diffing each package.json
 * version against npm's `latest`.
 *
 * `unpublished` is a refusal, not a release. Staged publishing cannot create a
 * package: npm rejects `npm stage publish` for a name it has never seen, so the
 * first version of anything has to go out by hand before this pipeline can
 * touch it.
 */
export function planReleases(
  packages: WorkspacePackage[],
  published: Map<string, string | null>,
): PlanEntry[] {
  return packages.map((pkg) => {
    const latest = published.get(pkg.name) ?? null;
    return { ...pkg, published: latest, verdict: verdictFor(pkg, latest) };
  });
}

function verdictFor(pkg: WorkspacePackage, latest: string | null): PlanVerdict {
  if (latest === null) return "unpublished";
  if (latest === pkg.version) return "current";
  return compareVersions(pkg.version, latest) > 0 ? "release" : "ahead";
}

/**
 * Compare two dotted versions. Numeric parts only, so a prerelease sorts as its
 * release would. Nothing here ships prereleases, and `current` catches the exact
 * match before this runs.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .replace(/^v/, "")
      .split(/[.+-]/)
      .map((n) => Number.parseInt(n, 10))
      .filter((n) => Number.isFinite(n));

  const left = parts(a);
  const right = parts(b);

  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * The `latest` dist-tag on npm, or null when the package does not exist.
 *
 * A network failure throws rather than returning null. The difference matters:
 * null means "publish the first version by hand", and a timeout that quietly
 * looked like that would strand a release with no failed job to notice.
 */
export async function latestVersion(pkg: string): Promise<string | null> {
  const url = `https://registry.npmjs.org/${pkg.replace("/", "%2f")}/latest`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`registry answered ${res.status} for ${pkg}`);
  }

  const body = (await res.json()) as { version?: unknown };
  if (typeof body.version !== "string") {
    throw new Error(`registry sent no version for ${pkg}`);
  }
  return body.version;
}

/** Look up every package's published version at once. */
export async function publishedVersions(
  packages: WorkspacePackage[],
): Promise<Map<string, string | null>> {
  const pairs = await Promise.all(
    packages.map(
      async (pkg) => [pkg.name, await latestVersion(pkg.name)] as const,
    ),
  );
  return new Map(pairs);
}

/** Bump one numeric part of a semver version, zeroing what follows it. */
export function bumpVersion(
  version: string,
  level: "major" | "minor" | "patch",
): string {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) throw new Error(`${version} is not a semver version`);

  const [major, minor, patch] = match.slice(1, 4).map(Number) as [
    number,
    number,
    number,
  ];

  if (level === "major") return `${major + 1}.0.0`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}
