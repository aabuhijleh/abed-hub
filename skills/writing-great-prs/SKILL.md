---
name: writing-great-prs
description: PR descriptions that carry their own evidence, meaning short prose plus an embedded visual. Use when writing a PR body, adding a screenshot to a PR, or showing an invisible change (API, schema, migration, config).
---

# Writing great PRs

A PR description is **evidence**. The reviewer sees the change working before reading a
line of the diff.

Lean on the visual, not the prose. A picture is parsed at a glance where a paragraph has to
be read, so anything you would explain in text, whether a flow, a shape, or a before and
after, show instead.

## Point the camera

| What changed | The shot |
|---|---|
| Frontend | The running app, driven to the changed state. Before and after when it already existed. |
| Invisible: API, schema, migration, query, perf | A throwaway HTML file that draws the shape. |
| Bug fix | The symptom, gone. |
| User supplied an image | Use it as-is. |

Draw the real mechanism, with the endpoints, columns, and states named as they are in the
diff. A sketch that would fit any PR is decoration.

GitHub renders bodies around 900px wide, so keep it to one idea per image, cropped tight,
with before and after labelled in the image itself.

## Capture

**A page you wrote**, the HTML file for an invisible change. `gh-attach shot` takes a path
or a URL and renders at 2x, cropped to the content:

```bash
gh-attach shot <page.html> <out.png> [--width 948]
```

948px wide lands at GitHub's 900px with no downscaling. Do **not** reach for
`playwright-cli` here. It blocks `file:` URLs, and it fails by screenshotting `about:blank`
and exiting 0, so you get a blank image and no error.

**The real UI.** Call the Skill tool with `playwright-cli` to drive the app, then
`playwright-cli screenshot --filename=<abs>.png --full-page`. Pass `gh-attach shot` the
dev-server URL instead if you only need a static shot.

Look at every image before you upload it. A screenshot is the one artifact where a silent
failure still produces a file.

## Upload and write

Call the Skill tool with `gh-attach` to upload and embed. One command carries both the
credential and the upload:

```bash
gh-attach upload <abs-path.png> --repo owner/repo
```

The `![name](url)` lines on stdout are what you embed. A reply of `uploadToken not found`
means the cookie went **stale**, so re-run the same command. That skill owns everything
else about credentials, so spend no turns on them here.

Everything visual goes under one `## Demo` heading, or the template's demo-shaped or
screenshot-shaped H2 when the repo has one.

Writing the body in one pass and the images in another leaves placeholder comments like
`<!--DEMO-->` stranded in a published description. If you do stage it that way, fill every
placeholder before you hand the PR over, and grep the body for leftovers:

```bash
gh pr view <pr> --repo owner/repo --json body -q .body | grep -o '<!--[A-Z-]*-->'
```

## Prose

Say what changed and why. The diff covers the rest, so two or three sentences is the whole
prose budget.

Call the Skill tool with `unslop` to edit the wording. Every string a reviewer reads is
user-facing, including the title, the body, and any comment you post with the PR, so run
each one through that skill and publish only what came back. That skill is required here.
If it is not installed, stop and give the user the install line from Requirements.

## Requirements

This skill does not work on its own. It needs [Bun](https://bun.sh), two commands, and two
other skills. All of them are required:

```bash
bun add -g @abed-hub/gh-attach
gh extension install drogers0/gh-image
bun add -g @playwright/cli
playwright-cli install-browser chromium
bunx skills add cursor/plugins -s unslop -g
bunx skills add microsoft/playwright-cli -s playwright-cli -g
```

`gh-attach` takes the screenshot and uploads it, and `gh-image` is the extension it uploads
through. `@playwright/cli` is the browser behind `gh-attach shot`, and
`playwright-cli install-browser chromium` is only needed when no chromium build is on the
machine yet. The `playwright-cli` skill drives the running app for UI shots. The `unslop`
skill edits every string a reviewer reads.

If one of these is missing, stop and give the user the line that installs it. Do not
substitute another screenshot tool, upload by hand, or skip `unslop`.
