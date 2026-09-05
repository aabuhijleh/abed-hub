# Contributing

A bun workspace. Every package lives under `packages/`, every skill under `skills/`, and the
scripts that run releases under `scripts/`.

```bash
bun install
bun run verify   # biome, tsc, and the tests, in parallel
bun run build
```

Lefthook runs biome, the typecheck, and the tests on commit, so a broken commit is hard to
make by accident. `bun run verify:fix` is the same set with biome writing its fixes.

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
