---
name: abed-hub
description: >-
  Install and repair the abed-hub tools and skills with the `abed-hub` CLI. Use when
  a hub command is missing (`gh-attach`, `jira`, `slack`), when a skill is behind the
  repo it came from, when `unslop` will not invoke, when you need where a config file
  lives or what is in it, or for "set up abed-hub".
license: MIT
allowed-tools: Bash(abed-hub:*)
---

# abed-hub

The CLI that installs the abed-hub tools and skills and keeps them current. Install it with
`bun add -g @aabuhijleh/abed-hub`.

## Ask the CLI what it does

`--help` is the source of truth for the commands, their flags, and the component names, and
it ships with the version on the machine. Read it before running anything, and again for
the command you land on.

```bash
abed-hub --help
abed-hub <command> --help
```

What follows is only what `--help` leaves out.

## Start with doctor

`abed-hub doctor` changes nothing and exits 1 when anything is missing, behind, or broken,
so run it on a hunch. A `warning`, such as unset Jira or Slack credentials, still exits 0:
it matters only to someone who uses that tool. `--json` is the machine read: every finding
carries a `status`, the `fix` that would repair it, and whether the CLI can run that fix
itself (`automatic`).

Every missing tool or skill goes the same way, including when another abed-hub skill sends
you here:

1. Run `abed-hub doctor`, with the component names when you know them.
2. Apply the fixes it marks automatic with `abed-hub update`, naming the same components.
3. Hand the rest to the user, as below.

Repair from the report rather than from a guess. `gh-attach shot` failing with `playwright
not found` is a missing `@playwright/cli`, not a broken `gh-attach`, and doctor names it.

`setup` installs what is absent and leaves a working version alone even when it is behind.
`update` is what moves it forward. `setup` with component names also saves them as the
whole selection, so reach for `update` when repairing.

## config answers where and what

`abed-hub config` prints every config file the installed components read: its path, what it
holds, and its contents. `--json` is the machine read. A file that is missing, empty, or
unparseable says so and names the command that writes it, which is the answer to "why does
`jira` say it has no credentials".

Tokens come back masked to their last four characters, which is enough to tell two
credentials apart. Leave them that way. `--reveal` prints a live secret into the
transcript, so pass it only when the user asks for the token itself.

## Three kinds of dependency

The report groups by them because each falls behind differently, and only the first is a
version number.

| Group | Behind means |
| --- | --- |
| Packages | The global bun install is below npm's `latest`. |
| Skills | The lock file's `skillFolderHash` no longer matches the folder on the source repo. |
| Tools | `gh` below 2.99, signed out, no `gh-stack` extension, no chromium build, or unset Jira or Slack credentials. |

## skills update undoes the unslop patch

Upstream ships `unslop` user-invoked, with a description that fires on any writing. The
patch switches model invocation on and narrows the description to PR titles and bodies,
Slack and Jira posts, agent answers, and human docs. `setup` and `update` apply it, and
`skills update` puts upstream's frontmatter back. When `unslop` cannot be invoked, that is
what happened, and `abed-hub update unslop` is the repair.

`doctor` reports it as `unslop patch`, separately from `unslop` itself, because the folder
hash still matches upstream. The staleness check stays green while the skill sits there
unusable.

## What it hands back to you

Credentials and package managers. `jira setup`, `slack setup`, `gh auth login`, installing
bun, and upgrading `gh` all print under "Run these yourself, they ask questions". Every one
of them prompts, so give them to the user instead of running them.

## Confirm before --force

`abed-hub setup --force` reinstalls what it would otherwise skip, including a chromium build
over 350 MB. Get the user's word first.
