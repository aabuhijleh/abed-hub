---
name: abed-hub
description: >-
  Install and repair the abed-hub tools and skills with the `abed-hub` CLI. Use when
  a hub command is missing (`gh-attach`, `jira`, `slack`), when a skill is behind the
  repo it came from, when `unslop` will not invoke, or for "set up abed-hub".
license: MIT
allowed-tools: Bash(abed-hub doctor:*), Bash(abed-hub setup:*), Bash(abed-hub update:*)
---

# abed-hub

The CLI that installs the abed-hub tools and skills and keeps them current. Install it with
`bun add -g @aabuhijleh/abed-hub`.

## Start with doctor

`abed-hub doctor` changes nothing and exits 1 when anything is missing, behind, or broken,
so run it on a hunch. `--json` is the machine read: every finding carries a `status`, the
`fix` that would repair it, and whether the CLI can run that fix itself.

```bash
abed-hub doctor --json
```

Repair from the report rather than from a guess. `gh-attach: command not found` is as
likely to be a signed-out `gh` or a missing skill as a missing package.

## setup installs, update upgrades

| | |
|---|---|
| `abed-hub setup [components...]` | Installs what is absent. Leaves a working version alone even when it is behind. |
| `abed-hub update [components...]` | Upgrades what is behind, installs what is absent, repairs the unslop patch. |

Both default to the components `setup` last saved, which `--all` overrides. The four names
are `gh-attach`, `gh-stack`, `writing-great-prs`, and `courier`.

Bare `abed-hub setup` opens a checklist and waits for a keyboard. Name the components, or
pass `--all`.

## Three kinds of dependency

The report groups by them because each falls behind differently, and only the first is a
version number.

| Group | Behind means |
|---|---|
| Packages | The global bun install is below npm's `latest`. |
| Skills | The lock file's `skillFolderHash` no longer matches the folder on the source repo. |
| Tools | `gh` below 2.99, signed out, no `gh-stack` extension, or no chromium build. |

## unslop goes user-invoked after every skills update

Upstream ships `unslop` with `disable-model-invocation: true`, which stops every other skill
from reaching it. `setup` and `update` strip that line, and `skills update` puts it back.
When `unslop` cannot be invoked, that is what happened, and `abed-hub update` is the repair.

`doctor` reports it as `unslop invocation`, separately from `unslop` itself, because the
folder hash still matches upstream. The staleness check stays green while the skill sits
there unusable.

## What it hands back to you

Credentials and package managers. `jira setup`, `slack setup`, `gh auth login`, installing
bun, and upgrading `gh` all print under "Run these yourself, they ask questions". Every one
of them prompts, so give them to the user instead of running them.

## Confirm before --force

`abed-hub setup --force` reinstalls what it would otherwise skip, including a chromium build
over 350 MB. Get the user's word first.
