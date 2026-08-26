# 🧰 abed-hub

Three agent skills, and the command line tools they drive.

Each one closes a gap where agents keep failing: getting a screenshot into a PR, getting a
file out of a Slack thread. The tool does the work. The skill teaches an agent when and how
to reach for it.

## 🚀 Install everything

```bash
curl -fsSL https://raw.githubusercontent.com/aabuhijleh/abed-hub/main/setup.sh | bash
```

Needs [bun](https://bun.sh) and the [GitHub CLI](https://cli.github.com). Re-run it any
time. It skips whatever is already there.

## 🧭 Or set them up by hand

| Skill | Use it for | Also needs |
| --- | --- | --- |
| [gh-attach](#-gh-attach) | Put an image, video, PDF, or log into a PR or issue. | The GitHub CLI, signed in |
| [writing-great-prs](#-writing-great-prs) | Write a PR description with a screenshot in it. | gh-attach, a browser, two more skills |
| [courier](#-courier) | Move files in and out of Jira issues and Slack threads. | An Atlassian token and a Slack app |

Set up one. Come back for the others when you need them.

## 📎 gh-attach

Uploads a local file to GitHub and prints a reference you can paste into a PR or issue.
GitHub has no public upload API, so it reaches the endpoint the web UI uses. It also
screenshots a page to a PNG.

```bash
gh-attach upload ./screenshot.png --repo owner/repo
```

```
![screenshot.png](https://github.com/user-attachments/assets/047450da-c514-46b2-ae67-8b3eca8f88da)
```

```bash
gh-attach shot ./page.html ./out.png --width 948
```

```
wrote ./out.png (1896x898 px, 2x of 948css)
```

### Setup

1. **Install the tool.** The `gh-image` extension is the uploader underneath, and the
   [GitHub CLI](https://cli.github.com) must be signed in.

   ```bash
   bun add -g @aabuhijleh/gh-attach
   gh extension install drogers0/gh-image
   ```

2. **Add the skill.**

   ```bash
   bunx skills add aabuhijleh/abed-hub -s gh-attach -g
   ```

3. **Check it.** `gh-attach token` prints the state of the GitHub session cookie, and grabs
   a fresh one from your browser if it is dead. Nothing else to configure.

Full command list: [`packages/gh-attach`](packages/gh-attach).

## 📝 writing-great-prs

Teaches an agent to write a PR description that carries its own evidence: short prose plus
an embedded visual. It drives other tools rather than shipping one of its own.

Ask for it in plain words.

```
write the PR description for this branch
```

What comes back, posted as the body:

```markdown
Testing `setup.sh` from scratch means tearing the install down first, and nothing
wrote down how. This adds the three commands that do it.

## Demo

![uninstall.png](https://github.com/user-attachments/assets/047450da-…)
```

A real one: [#1](https://github.com/aabuhijleh/abed-hub/pull/1).

### Setup

1. **Set up [gh-attach](#-gh-attach) first.** It takes the screenshot and uploads it.

2. **Add a browser.** This is what `gh-attach shot` renders pages with. The second line is
   only needed if no chromium build is on the machine yet.

   ```bash
   bun add -g @playwright/cli
   playwright-cli install-browser chromium
   ```

3. **Add the skills.** All three, they are not optional. `playwright-cli` drives a real app
   for UI screenshots, and `unslop` edits the title and body before they go out.

   ```bash
   bunx skills add aabuhijleh/abed-hub -s writing-great-prs -g
   bunx skills add microsoft/playwright-cli -s playwright-cli -g
   bunx skills add cursor/plugins -s unslop -g
   ```

## 📬 courier

Two tools, `jira` and `slack`, that reach the parts of Jira and Slack the Atlassian and
Slack MCPs cannot: attachment bytes in both directions, deleting a Slack post, writing a
Jira description with checkboxes or embedded images.

```bash
slack thread https://acme.slack.com/archives/C0123456789/p1700000000000000
```

```
◇  Fetched 3 message(s)

   Ada Lovelace · 2026-08-26T09:34:14.000Z
   the nightly export failed again
     • F0BSC0Y4FGF · error.log (text/plain, 4.2 KB)
```

Files come down, then go up somewhere else.

```bash
slack pull <slack-permalink> --out ./evidence
jira attach ABC-123 ./evidence/*
```

```
◇  Downloaded 2 file(s) to ./evidence
◇  Uploaded 2 attachments to ABC-123
```

### Setup

1. **Install the tools.** One package, both bins.

   ```bash
   bun add -g @aabuhijleh/courier
   ```

2. **Set up credentials.** Each command prints the steps for creating the token in your
   browser, then saves what you paste in. `slack setup` lists the bot scopes to add first,
   and checks the token against Slack before saving it.

   ```bash
   jira setup     # an Atlassian API token
   slack setup    # a Slack app and its bot token
   ```

3. **Add the skill.**

   ```bash
   bunx skills add aabuhijleh/abed-hub -s courier -g
   ```

One thing to know: the Slack bot only sees channels it has been invited to, and cannot read
human DMs. Run `/invite @<bot>` where you need it. Full command list and the rest of the
bot's limits: [`packages/courier`](packages/courier).

## 🔐 Configuration

Every tool keeps its state in one place, `$XDG_CONFIG_HOME/abed-hub/` when that is set and
`~/.config/abed-hub/` otherwise. These files hold API tokens, so the directory is 0700 and
each file is 0600.

```
~/.config/abed-hub/
├── courier/config.json   a jira section and a slack section: base URL, email, API token, bot token
└── gh-attach/token       the GitHub session cookie that gh-image uploads with
```

Read it back with the tokens masked. `jira config --reveal` prints one in full.

```bash
jira config
slack config
gh-attach token
```

Let the setup commands write these. A token typed in by hand, or passed on a command line,
lands in your shell history. `setup.sh` never touches this directory, so reinstalling keeps
your credentials and deleting the directory is a clean reset.

## 🧹 Uninstall

```bash
bun remove -g @aabuhijleh/gh-attach @aabuhijleh/courier @playwright/cli
bunx skills remove gh-attach writing-great-prs courier playwright-cli unslop -g -y
gh extension remove gh-image
```

Skill names are positional. The `-s gh-attach,courier` form prints "No matching skills
found" and removes nothing.

Chromium and your tokens stay. Chromium is shared with every other playwright install on
the machine, and the tokens in `~/.config/abed-hub/` save you a browser trip on the next
install. Delete either by hand if you want them gone.
