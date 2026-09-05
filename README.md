# 🧰 abed-hub

Agent skills, and the command line tools they drive.

Each one closes a gap where agents keep failing: getting a screenshot into a PR, getting a
file out of a Slack thread. The tool does the work. The skill teaches an agent when and how
to reach for it.

## 🚀 [abed-hub](https://www.npmjs.com/package/@aabuhijleh/abed-hub)

One CLI installs the rest of this and keeps it current.

```bash
bun add -g @aabuhijleh/abed-hub
abed-hub setup
```

Needs [bun](https://bun.sh). `setup` asks which components you want, installs what is
missing, and leaves anything that already works alone. Its own skill comes along, so an
agent that hits a missing tool can diagnose it instead of guessing.

An install here is a chain, and every link falls behind on its own schedule. `doctor`
checks all three kinds and changes nothing.

```bash
abed-hub doctor
```

```
┌  abed-hub doctor
│
◇  Packages
│
│  ✔ @aabuhijleh/abed-hub   0.1.0
│  ▲ @aabuhijleh/gh-attach  0.1.0 → 0.2.0
│  ✔ @aabuhijleh/courier    0.1.0
│  ✔ @playwright/cli        0.1.19
│
◇  Skills
│
│  ✔ abed-hub           b41f0c2
│  ▲ gh-attach          behind aabuhijleh/abed-hub
│  ✔ writing-great-prs  07e5f7d
│  ✔ unslop             3515323
│  ! unslop invocation  disable-model-invocation is back
│  ✔ courier            42413a9
│
◇  Tools
│
│  ✔ bun               1.4.2
│  ✔ gh                2.100.0
│  ✔ gh auth           signed in as aabuhijleh
│  ✖ chromium          what gh-attach renders pages with
│  ✔ jira credentials  configured
│
└  2 behind, 1 missing, 1 needing repair. abed-hub setup fixes what it can.
```

`abed-hub update` then upgrades the packages against npm, pulls the skills that moved, and
strips `disable-model-invocation` back off `unslop`, which upstream reinstates on every
skill update. Credentials it hands back to you, since those ask questions.

Full command list: [`packages/abed-hub`](packages/abed-hub).

## 🧭 Or set them up by hand

| Skill | Use it for | Also needs |
| --- | --- | --- |
| [gh-attach](#-gh-attach) | Put a screenshot into a PR or issue. | The GitHub CLI 2.99+, signed in |
| [writing-great-prs](#-writing-great-prs) | Write a PR description with a screenshot in it. | gh-attach, a browser, the skills below |
| [gh-stack](#-gh-stack) | Break a change into PRs that build on each other. | The GitHub CLI, signed in, plus one extension |
| [courier](#-courier) | Move files in and out of Jira issues and Slack threads. | An Atlassian token and a Slack app |

Set up one. Come back for the others when you need them.

## 📎 [gh-attach](https://www.npmjs.com/package/@aabuhijleh/gh-attach)

Screenshots a page to a PNG sized for GitHub, and teaches an agent to attach it.

```bash
gh-attach shot ./page.html ./out.png --width 948
```

```
wrote ./out.png (1896x898 px, 2x of 948css)
```

Uploading is `gh`'s job since 2.99.0, so one command publishes the shot:

```bash
gh pr comment 12 --attach "./out.png#Login error state"
```

The skill is the half of this that matters. It carries what `gh` accepts, which file types
fail before anything uploads, and the difference between appending to a description and
replacing it.

### Setup

1. **Install the tool.** The [GitHub CLI](https://cli.github.com) must be 2.99 or later and
   signed in, since that is where `--attach` landed.

   ```bash
   bun add -g @aabuhijleh/gh-attach
   ```

2. **Add the skill.**

   ```bash
   bunx skills add aabuhijleh/abed-hub -s gh-attach -g
   ```

Nothing else to configure. There are no credentials of its own.

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

1. **Set up [gh-attach](#-gh-attach) first.** It takes the screenshot, and `gh --attach`
   publishes it.

2. **Add a browser.** This is what `gh-attach shot` renders pages with. The second line is
   only needed if no chromium build is on the machine yet.

   ```bash
   bun add -g @playwright/cli
   playwright-cli install-browser chromium
   ```

3. **Add the skills.** None of them are optional. `playwright-cli` drives a real app
   for UI screenshots, and `unslop` edits the title and body before they go out.

   ```bash
   bunx skills add aabuhijleh/abed-hub -s writing-great-prs -g
   bunx skills add microsoft/playwright-cli -s playwright-cli -g
   bunx skills add cursor/plugins -s unslop -g
   ```

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

`--help` covers the flags, so the skill carries what it leaves out: which commands open a
full-screen TUI and hang an agent that has no keyboard behind it, that `submit --auto`
opens drafts, what each of the ten exit codes means. It also argues against stacking, which
is the right call most of the time.

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
├── abed-hub/config.json  which components setup installed
└── courier/config.json   jira and slack sections: base URL, email, API token, bot token
```

Read it back with the tokens masked. `jira config --reveal` prints one in full.

```bash
jira config
slack config
```

Let the setup commands write these. A token typed in by hand, or passed on a command line,
lands in your shell history. `abed-hub setup` never writes a credential, so reinstalling
keeps them and deleting the directory is a clean reset.

## 🚢 Releasing

Bumping a version is the whole release. Merge the bump to main and
[Release](.github/workflows/release.yml) diffs every package against npm and stages the
ones that moved.

```bash
bun run bump          # pick packages, pick patch, minor, or major
bun run release:plan  # what the next push to main would stage
```

Nothing goes public on its own. CI authenticates with an OIDC token from GitHub, so no
`NPM_TOKEN` lives in this repo, and it runs `npm stage publish`, which needs no 2FA. The
tarball then sits in npm's staging queue until a maintainer approves it.

```bash
npm stage list @aabuhijleh/gh-attach
npm stage approve <stage-id>
```

Both of those want 2FA, and the package's Staged tab on npmjs.com does the same job in a
browser. Approving publishes the version with a provenance attestation, which trusted
publishing attaches without being asked.

Staged publishing cannot create a package, so the first version of a new one goes out by
hand with `npm publish`. `bun run release:plan` says so when it finds a name npm has never
seen.

## 🧹 Uninstall

```bash
bun remove -g @aabuhijleh/abed-hub @aabuhijleh/gh-attach @aabuhijleh/courier @playwright/cli
bunx skills remove abed-hub gh-attach gh-stack writing-great-prs courier playwright-cli unslop -g -y
gh extension remove github/gh-stack
```

Skill names are positional. The `-s gh-attach,courier` form prints "No matching skills
found" and removes nothing.

Chromium and your tokens stay. Chromium is shared with every other playwright install on
the machine, and the tokens in `~/.config/abed-hub/` save you a browser trip on the next
install. Delete either by hand if you want them gone.
