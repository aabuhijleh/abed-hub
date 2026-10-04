# 🧰 abed-hub

Agent skills, and the command line tools they drive.

Each one closes a gap where agents keep failing: getting a screenshot into a PR, getting a
file out of a Slack thread. The tool does the work. The skill teaches an agent when and how
to reach for it.

## 🚀 [abed-hub](https://www.npmjs.com/package/@aabuhijleh/abed-hub)

One CLI installs the rest of this and keeps it current. Needs [bun](https://bun.sh).

```bash
bun add -g @aabuhijleh/abed-hub

abed-hub setup     # pick components, install what is missing
abed-hub doctor    # what is behind, missing, or broken. Changes nothing
abed-hub update    # upgrade whatever doctor found
abed-hub config    # where every config file is, and what is in it
```

## 🧭 Or set them up by hand

| Skill | Use it for | Also needs |
| --- | --- | --- |
| [gh-attach](#-gh-attach) | Put a screenshot into a PR or issue. | The GitHub CLI 2.99+, signed in, and a browser |
| [visuals](#-gh-attach) | Take an annotated before/after image of the change. | gh-attach, and the `playwright-cli` skill |
| [gh-stack](#-gh-stack) | Break a change into PRs that build on each other. | The GitHub CLI, signed in, plus one extension |
| [courier](#-courier) | Move files in and out of Jira issues and Slack threads. | An Atlassian token and a Slack app |
| [deslop](#-deslop) | Cut AI tells from PR bodies, Slack and Jira posts, and docs. | Nothing |

Set up one. Come back for the others when you need them.

## 📎 [gh-attach](https://www.npmjs.com/package/@aabuhijleh/gh-attach)

Screenshots a page to a PNG sized for GitHub, and teaches an agent to attach it. Two skills
split the work. `visuals` crops to the changed element, rings it when the crop holds
more than the change, and frames before and after side by side. For a change behind the
UI, it draws the real failing case before and after instead, as a flow, a table, a timeline
or an order strip. The same images explain anything else, in an answer, a Slack or Jira
post, or a doc: what happened in a bug, how a system works, a result. A text change goes in
as a diff instead of an image.
`gh-attach` puts the result in the PR description under `## Evidence`.

```bash
gh-attach shot ./page.html ./out.png --width 948
```

```
wrote ./out.png (1896x898 px, 2x of 948css)
```

Uploading is `gh`'s job since 2.99.0, so one command publishes the shot:

```bash
gh pr edit 12 --attach "./out.png#Login error state"
```

The `gh-attach` skill carries what `gh` accepts, which file types fail before anything
uploads, how appending to a description differs from replacing it, and how to put an image
under `## Evidence` in a description that already exists.

### Setup

1. **Install the tool.** The [GitHub CLI](https://cli.github.com) must be 2.99 or later and
   signed in, since that is where `--attach` landed.

   ```bash
   bun add -g @aabuhijleh/gh-attach
   ```

2. **Add a browser.** This is what `gh-attach shot` renders pages with. The second line is
   only needed if no chromium build is on the machine yet.

   ```bash
   bun add -g @playwright/cli
   playwright-cli install-browser chromium
   ```

3. **Add the skills.** `playwright-cli` drives the running app to the state worth showing.
   `pr` writes the PR body the image goes into.

   ```bash
   bunx skills add aabuhijleh/abed-hub -s gh-attach -g
   bunx skills add aabuhijleh/abed-hub -s visuals -g
   bunx skills add microsoft/playwright-cli -s playwright-cli -g
   bunx skills add mattpocock/skills -s pr -g
   ```

No credentials of its own.

## 🥞 gh-stack

Teaches an agent to drive [`gh stack`](https://gh.io/stacks), GitHub's extension for chains
of pull requests where each one builds on the one below.

Ask for it in plain words.

```
open this as a PR on top of my other one
```

```bash
gh stack init refactor/native-gh-attach feat/gh-stack-skill
gh stack submit --auto --open
```

`--help` covers the flags. The skill carries what it leaves out: which commands open a
full-screen TUI and hang an agent, that `submit --auto` opens drafts, and what each of the
ten exit codes means. It also argues against stacking, which is usually the right call.

### Setup

1. **Install the extension.** Needs the [GitHub CLI](https://cli.github.com), signed in.

   ```bash
   gh extension install github/gh-stack
   ```

2. **Add the skill.**

   ```bash
   bunx skills add aabuhijleh/abed-hub -s gh-stack -g
   ```

Stacked pull requests are in public preview, and a repo can have them switched off. When
one does, every `gh stack` command exits 9.

## 📬 [courier](https://www.npmjs.com/package/@aabuhijleh/courier)

`jira` and `slack` reach the parts of Jira and Slack the Atlassian and Slack MCPs cannot:
attachment bytes in both directions, deleting a Slack post, writing a Jira description with
checkboxes or embedded images.

```bash
slack thread https://acme.slack.com/archives/C0123456789/p1700000000000000
```

```
◇  Fetched 3 message(s)

   Ada Lovelace · 2026-08-26T09:34:14.000Z
   the nightly export failed again
     • F0123456789 · error.log (text/plain, 4.2 KB)
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
human DMs. Run `/invite @<bot>` where you need it.

## ✂️ deslop

A list of AI tells and their rewrites, for prose people read: PR titles and bodies, Slack
and Jira posts, an agent's answers, READMEs. It is a copy of
[`unslop`](https://github.com/cursor/plugins/blob/main/pstack/skills/unslop/SKILL.md) by
Lauren Tan, from Cursor's pstack plugin. Upstream fires on any writing and only a person can
invoke it. `deslop` names what it applies to, and an agent or another skill can call it.
[CREDITS.md](skills/deslop/CREDITS.md) lists what changed and carries unslop's MIT notice.

### Setup

```bash
bunx skills add aabuhijleh/abed-hub -s deslop -g
```

## 🔐 Configuration

Every tool keeps its state in one place, `$XDG_CONFIG_HOME/abed-hub/` when that is set and
`~/.config/abed-hub/` otherwise. These files hold API tokens, so the directory is 0700 and
each file is 0600.

```
~/.config/abed-hub/
├── abed-hub/config.json  which components setup installed
└── courier/config.json   jira and slack sections: base URL, email, API token, bot token
```

Read them back with the tokens masked. `abed-hub config` walks every file at once, and
each tool prints its own. `--reveal` on any of them prints a token in full.

```bash
abed-hub config
jira config
slack config
```

Let the setup commands write these, since a token passed on a command line lands in your
shell history. `abed-hub setup` never touches them, so reinstalling keeps your credentials
and deleting the directory is a clean reset.

## 🧹 Uninstall

```bash
bun remove -g @aabuhijleh/abed-hub @aabuhijleh/gh-attach @aabuhijleh/courier @playwright/cli
bunx skills remove abed-hub gh-attach visuals gh-stack courier deslop playwright-cli pr -g -y
gh extension remove github/gh-stack
```

Skill names are positional. The `-s gh-attach,courier` form prints "No matching skills
found" and removes nothing.

Other toolsets can depend on `@playwright/cli` and the `playwright-cli` and `pr` skills. If
one does, take those names out of the first two lines.

Before `deslop`, abed-hub installed Cursor's `unslop` and edited its frontmatter. A machine
set up then still has that copy in `~/.agents/skills`, and abed-hub leaves it there. Remove
it with `bunx skills remove unslop -g`.

The `visuals` skill was called `screenshots` until the rename, and abed-hub leaves the old
copy in place too. Remove it with `bunx skills remove screenshots -g`.

Chromium and your tokens stay. Chromium is shared with every other playwright install on the
machine, and the tokens save you a browser trip next time. Delete either by hand.

Releasing, the checks, and the rest of the maintainer side live in
[CONTRIBUTING.md](CONTRIBUTING.md).
