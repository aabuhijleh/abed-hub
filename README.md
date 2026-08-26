# abed-hub

Three agent skills, and the command line tools they drive.

Each one closes a gap where agents keep failing: getting a screenshot into a PR, getting a
file out of a Slack thread. The tool does the work. The skill teaches an agent when and how
to reach for it.

## Install everything

```bash
curl -fsSL https://raw.githubusercontent.com/aabuhijleh/abed-hub/main/setup.sh | bash
```

Installs the three tools, their skills, and the browser, all globally. Needs
[bun](https://bun.sh) and the [GitHub CLI](https://cli.github.com). Nothing runs as root.
It ends by printing the credential commands, which ask questions and so are yours to run.
Read it first if you like: [`setup.sh`](setup.sh).

Re-running is fine. Every step looks for its own result first, so a second run installs
nothing and just tells you what it found. Add `--force` to reinstall and upgrade anyway.

Want one piece only? Name it. `writing-great-prs` pulls in `gh-attach` with it.

```bash
curl -fsSL https://raw.githubusercontent.com/aabuhijleh/abed-hub/main/setup.sh | bash -s -- courier
```

## Or set them up by hand

| Skill | Use it for | Also needs |
| --- | --- | --- |
| [gh-attach](#gh-attach) | Put an image, video, PDF, or log into a PR or issue. | The GitHub CLI, signed in |
| [writing-great-prs](#writing-great-prs) | Write a PR description with a screenshot in it. | gh-attach, a browser, two more skills |
| [courier](#courier) | Move files in and out of Jira issues and Slack threads. | An Atlassian token and a Slack app |

Set up one. Come back for the others when you need them.

## gh-attach

Uploads a local file to GitHub and prints a reference you can paste into a PR or issue.
GitHub has no public upload API, so it reaches the endpoint the web UI uses. It also
screenshots a page to a PNG.

```bash
gh-attach upload ./screenshot.png --repo owner/repo
# ![screenshot.png](https://github.com/user-attachments/assets/…)
```

**1. Install the tool.** The `gh-image` extension is the uploader underneath, and the
[GitHub CLI](https://cli.github.com) must be signed in.

```bash
bun add -g @aabuhijleh/gh-attach
gh extension install drogers0/gh-image
```

**2. Add the skill.**

```bash
bunx skills add aabuhijleh/abed-hub -s gh-attach -g
```

**3. Check it.** `gh-attach token` prints the state of the GitHub session cookie, and
grabs a fresh one from your browser if it is dead. Nothing else to configure.

Full command list: [`packages/gh-attach`](packages/gh-attach).

## writing-great-prs

Teaches an agent to write a PR description that carries its own evidence: short prose plus
an embedded visual. It drives other tools rather than shipping one of its own.

**1. Set up [gh-attach](#gh-attach) first.** It takes the screenshot and uploads it.

**2. Add a browser.** This is what `gh-attach shot` renders pages with. The second line is
only needed if no chromium build is on the machine yet.

```bash
bun add -g @playwright/cli
playwright-cli install-browser chromium
```

**3. Add the skills.** All three, they are not optional. `playwright-cli` drives a real app
for UI screenshots, and `unslop` edits the title and body before they go out.

```bash
bunx skills add aabuhijleh/abed-hub -s writing-great-prs -g
bunx skills add microsoft/playwright-cli -s playwright-cli -g
bunx skills add cursor/plugins -s unslop -g
```

## courier

Two tools, `jira` and `slack`, that reach the parts of Jira and Slack the Atlassian and
Slack MCPs cannot: attachment bytes in both directions, deleting a Slack post, writing a
Jira description with checkboxes or embedded images.

```bash
slack pull <slack-permalink> --out ./evidence   # the thread's files, descriptively named
jira attach ABC-123 ./evidence/*
```

**1. Install the tools.** One package, both bins.

```bash
bun add -g @aabuhijleh/courier
```

**2. Set up credentials.** Each command prints the steps for creating the token in your
browser, then saves what you paste in. `slack setup` lists the bot scopes to add first, and
checks the token against Slack before saving it.

```bash
jira setup     # an Atlassian API token
slack setup    # a Slack app and its bot token
```

**3. Add the skill.**

```bash
bunx skills add aabuhijleh/abed-hub -s courier -g
```

One thing to know: the Slack bot only sees channels it has been invited to, and cannot read
human DMs. Run `/invite @<bot>` where you need it. Full command list and the rest of the
bot's limits: [`packages/courier`](packages/courier).
