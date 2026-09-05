# @aabuhijleh/abed-hub

Installs the abed-hub tools and skills, tells you what has fallen behind, and brings it up
to date.

```bash
abed-hub setup
abed-hub doctor
abed-hub update
```

Everything installs globally into your bun and skills directories. Nothing needs root.

## Three kinds of dependency

An install here is a chain, and every link goes stale on its own schedule. `doctor` checks
all three and groups the report the same way.

| Kind | Installed by | Behind when |
| --- | --- | --- |
| Packages | `bun add -g` | The global version is below npm's `latest`. |
| Skills | `bunx skills add` | `~/.agents/.skill-lock.json` holds a `skillFolderHash` the source repo no longer has. |
| Tools | Someone else | `gh` is below 2.99, signed out, missing the `gh-stack` extension, or has no chromium build. |

The skill check is the one worth explaining. The `skills` installer records the git tree SHA
of the skill's folder as it stood on the source repo's default branch, so comparing it
against `gh api repos/<owner>/<repo>/contents/skills` answers "is the copy on this machine
behind" without cloning anything.

## Components

`setup` with no arguments asks which ones you want and remembers the answer. `doctor` and
`update` work from that answer afterwards, so a machine that only wanted courier is never
told it is missing chromium.

| Component | What you get |
| --- | --- |
| `gh-attach` | Put a screenshot into a PR or issue. |
| `gh-stack` | Break a change into PRs that build on each other. |
| `writing-great-prs` | Write a PR description with a screenshot in it. Pulls in `gh-attach`. |
| `courier` | Move files in and out of Jira issues and Slack threads. |

Name them to skip the prompt. `all` is all four, `prs` is `writing-great-prs`.

```bash
abed-hub setup gh-attach courier
```

The `abed-hub` skill installs with every selection, whichever components you pick.

## The unslop patch

`writing-great-prs` cannot do its job without `unslop`, and upstream ships `unslop` with
`disable-model-invocation: true`, which stops one skill from reaching another. `setup`
strips that line after installing, `update` strips it again after every update, and
`doctor` reports it when it comes back.

This check reads the installed `SKILL.md`, not the lock file. `skillFolderHash` records
what upstream looked like at install time, so a local edit leaves it matching. The hash
answers "is this behind upstream". Reading the frontmatter answers "has the patch been
undone".

## Commands

| Command | What it does |
| --- | --- |
| `abed-hub setup [components...] [--all] [--force]` | Install what is absent. Leaves anything that works alone unless `--force`. |
| `abed-hub doctor [components...] [--all] [--json]` | Report and change nothing. Exits 1 when something is missing, behind, or broken. |
| `abed-hub update [components...] [--all]` | Upgrade what is behind, install what is absent, repair the unslop patch. |

Neither `setup` nor `update` touches credentials. Both print the interactive commands that
set those up, since a token has to be pasted in by a human.

## Prerequisites

[Bun](https://bun.sh). The GitHub CLI at 2.99 or later for anything that talks to GitHub,
which `doctor` will tell you about rather than assume.

## Configuration

The saved component selection lives at `~/.config/abed-hub/abed-hub/config.json`, alongside
every other tool's state. The directory is 0700 and the file is 0600.

## Develop

```bash
bun install
bunx tsc --noEmit
bun test
bun run build
```
