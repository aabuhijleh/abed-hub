# @abed-hub/gh-attach

Uploads a local file to GitHub and prints a reference you can paste into a pull request or
issue. GitHub has no public upload API, so this reaches the endpoint the web UI uses,
through the [`gh-image`](https://github.com/drogers0/gh-image) extension.

```bash
gh-attach upload ./screenshot.png --repo owner/repo
# ![screenshot.png](https://github.com/user-attachments/assets/…)
```

One reference per file on stdout: `![name](url)` for an image, a bare URL for video,
`[name](url)` for anything else. Progress and warnings go to stderr, so stdout pipes
cleanly.

## Prerequisites

[Bun](https://bun.sh) and the [GitHub CLI](https://cli.github.com), signed in.

macOS is the tested platform. Linux works when the browser cookie store is readable. On
Windows, use WSL.

## Install

```bash
bun add -g @abed-hub/gh-attach
gh extension install drogers0/gh-image
```

`gh-attach shot` needs a browser on top of that. Playwright is a prerequisite you install
yourself rather than a dependency of this package:

```bash
bun add -g @playwright/cli
playwright-cli install-browser chromium   # only if no chromium build is installed yet
```

## Commands

| Command | What it does |
| --- | --- |
| `gh-attach upload <files…> [--repo owner/repo]` | Upload and print an embeddable reference for each file. `--repo` is optional inside a repo. |
| `gh-attach shot <page.html\|url> <out.png> [--width 948]` | Screenshot a page to a PNG at 2x, cropped to its content. |
| `gh-attach token [--force]` | Check the stored session cookie, rotating it if it is dead. |

948px is the default width because it lands at GitHub's 900px render width with no
downscaling.

## The credential

`gh image` authenticates with a GitHub browser session cookie, not an API token, because
that is what the upload endpoint accepts. The cookie expires every few weeks.

`gh-attach` checks the cookie before every upload and extracts a fresh one from the browser
when it is dead. Nothing runs in the background and nothing installs a scheduled job.

The cookie is stored at `~/.config/abed-hub/gh-attach/token`, or under `$XDG_CONFIG_HOME`
when that is set. The file is mode 600 inside a mode 700 directory, so your user account
can read it and no other account on the machine can read it or list the directory. It is
passed to one child process at a time as `GH_SESSION_TOKEN` rather than on the command
line, where `ps` would show it.

The cookie grants full account access. GitHub offers nothing narrower for this endpoint, so
treat it accordingly. On macOS, extraction reads the Chrome Safe Storage Keychain item and
needs a logged-in desktop session, which means it cannot work over plain SSH or in CI.

## Develop

```bash
bun install
bunx tsc --noEmit
bun run build
```
