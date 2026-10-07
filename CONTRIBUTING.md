# Contributing

A bun workspace. Every package lives under `packages/`, every skill under `skills/`, and the
scripts that run releases under `scripts/`.

```bash
bun install
bun run verify   # biome, tsc, the tests, and the skill lint, in parallel
bun run build
```

Lefthook runs `bun run skills:sync`, then biome, the typecheck, and the tests on commit, plus
`bun run skills:lint` when a skill changes. `bun run verify:fix` runs the checks and lets biome
write its fixes.

## Forked skills

`deslop` is Cursor's `unslop` with our own frontmatter and a few patches. `FORKS` in
[`scripts/lib/forks.ts`](scripts/lib/forks.ts) lists each forked skill, its upstream file,
and the patches as exact find-and-replace pairs. `CREDITS.md` pins the upstream commit.

```bash
bun run skills:sync        # take upstream's latest body, apply the patches, repin CREDITS.md
bun run skills:sync:check  # fail if upstream moved, or the body differs from it plus the patches
```

Sync stops when a patch no longer matches upstream exactly once, so you fix the patch and
nothing gets applied in the wrong place. Upstream's frontmatter is never copied over. When it
changes, sync prints a compare link so you can decide whether ours should follow.

Every commit runs the sync first and stages what it changed, so an upstream update lands in
whatever you commit next. Offline, the hook skips it. CI runs the check, so a push to main
or a PR fails while a fork is behind, and so does a release.

## Releasing

Bumping a version is the whole release. Merge the bump to main and
[Release](.github/workflows/release.yml) diffs every package against npm and stages the
ones that moved.

```bash
bun run bump          # pick packages, pick patch, minor, or major
bun run release:plan  # what the next push to main would stage
```

Nothing goes public on its own. CI authenticates with an OIDC token from GitHub, so no
`NPM_TOKEN` lives in this repo, and it runs `npm stage publish`, which needs no 2FA. The
tarball then sits in npm's staging queue until you decide on it.

```bash
bun run approve
```

That lists everything waiting, shows each one's move (`0.1.0 → 0.2.0`), tag, shasum, and who
staged it, then asks package by package. Skip is the default. Reject asks twice, since
getting a discarded tarball back means another CI run. Approve hands the terminal to
`npm stage approve`, which wants your second factor and publishes with a provenance
attestation that trusted publishing attaches without being asked.

An entry staged by anything other than CI is called out, because this repo only releases
from GitHub Actions. The package's Staged tab on npmjs.com does the same job in a browser.

The staging run also tags the commit `gh-attach@0.2.0` and opens a GitHub Release for it,
whose notes list the commits under that package's directory since its own last tag. Tags
carry the package name because the three versions move independently.

`npm stage` arrived in npm 11.15.0. Anything older cannot approve.

## Publishing a package for the first time

Staged publishing cannot create a package, so version one of anything new goes out by hand:

```bash
bun run --filter '<package>' build
cd packages/<dir> && npm publish
```

Then register the trusted publisher on npmjs.com under the package's Settings, pointing at
`aabuhijleh/abed-hub` and `release.yml`, with `npm stage publish` as the only allowed action.
Until both are done, `bun run release:plan` names the package and refuses to stage it.

## Commits and branches

Conventional Commits, lowercase verb after the type: `feat: add auth`,
`fix: resolve cache bug`. Branches are `type/short-description`.
