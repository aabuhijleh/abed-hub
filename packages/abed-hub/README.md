# @aabuhijleh/abed-hub

Installs the abed-hub tools and skills, tells you what has fallen behind, and brings it up
to date.

```bash
abed-hub setup
abed-hub doctor
abed-hub update
abed-hub config
```

Everything installs globally into your bun and skills directories. Nothing needs root.

## Three kinds of dependency

An install here is a chain, and every link goes stale on its own schedule. `doctor` checks
all three and groups the report the same way.

| Kind | Installed by | Behind when |
| --- | --- | --- |
| Packages | `bun add -g` | The global version is below npm's `latest`. |
| Skills | `bunx skills add` | `~/.agents/.skill-lock.json` holds a `skillFolderHash` the source repo no longer has. |
| Tools | Someone else | `gh` is below 2.99, signed out, or missing the `gh-stack` extension. No chromium build is installed. The Jira or Slack credentials are unset, which is a warning. |

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
| `gh-attach` | Take an annotated screenshot and put it into a PR or issue. Brings `@playwright/cli`, chromium, and the `screenshots` and `playwright-cli` skills. |
| `gh-stack` | Break a change into PRs that build on each other. |
| `unslop` | Cut AI tells from PR bodies, Slack and Jira posts, and docs. Brings Cursor's `unslop` skill, patched. |
| `courier` | Move files in and out of Jira issues and Slack threads. |

Name them to skip the prompt. `all` is all four.

`writing-great-prs` and its alias `prs` are gone. Its parts moved to `gh-attach` and
`unslop`. Naming either one prints that, and a saved selection that holds it reads as those
two.

```bash
abed-hub setup gh-attach courier
```

The `abed-hub` skill installs with every selection, whichever components you pick.

## The unslop patch

Upstream ships `unslop` with `disable-model-invocation: true`, which stops one skill from
reaching another, and with a description that fires on any writing. The patch removes that
line and narrows the description to PR titles and bodies, Slack and Jira posts, agent
answers, and docs people read. It also leaves the fixed headings and bold labels of the
`pr` skill and of PR templates alone. `setup` applies it after installing, `update` applies
it again after every update, and `doctor` reports `unslop patch` when upstream's
frontmatter comes back.

This check reads the installed `SKILL.md`, not the lock file. `skillFolderHash` records
what upstream looked like at install time, so a local edit leaves it matching. The hash
answers "is this behind upstream". Reading the frontmatter answers "has the patch been
undone".

## Commands

| Command | What it does |
| --- | --- |
| `abed-hub setup [components...] [--all] [--force]` | Install what is absent. Leaves anything that works alone unless `--force`. |
| `abed-hub doctor [components...] [--all] [--json]` | Report and change nothing. Exits 1 when something is missing, behind, or broken. Warnings, such as unset Jira or Slack credentials, exit 0. |
| `abed-hub update [components...] [--all]` | Upgrade what is behind, install what is absent, reapply the unslop patch. |
| `abed-hub config [components...] [--all] [--reveal] [--json]` | Print where each config file is and what is in it. Tokens masked. |

Neither `setup` nor `update` touches credentials. Both print the interactive commands that
set those up, since a token has to be pasted in by a human.

## Prerequisites

[Bun](https://bun.sh). The GitHub CLI at 2.99 or later for anything that talks to GitHub,
which `doctor` will tell you about rather than assume.

## Configuration

The saved component selection lives at `~/.config/abed-hub/abed-hub/config.json`, alongside
every other tool's state. The directory is 0700 and the file is 0600.

`abed-hub config` prints that file and every other one the installed components read, each
with its path. A file that is missing, empty, or unparseable says so and names the command
that writes it, which is usually the answer to why `jira` claims it has no credentials.

```bash
abed-hub config
abed-hub config --json
```

Tokens come back as their last four characters. `--reveal` prints them in full, which is
worth thinking about before you paste the output anywhere.

## Develop

```bash
bun install
bunx tsc --noEmit
bun test
bun run build
```
