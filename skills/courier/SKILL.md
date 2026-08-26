---
name: courier
description: Reach Jira and Slack where the Atlassian and Slack MCPs stop, via the `jira` and `slack` CLIs. Use to download a ticket's or thread's attachments, upload a file to a Jira issue or Slack message, delete a Slack post, or write a Jira description with checkboxes or embedded images.
---

# courier

The Atlassian and Slack MCP tools are the default reach for Jira and Slack. `courier`
installs two bins, `jira` and `slack`, to close the **gaps** those MCPs leave. File bytes
and take-backs are the gaps they close today: pulling a ticket's or thread's attachments
onto disk, pushing files back up as a Jira attachment or onto a Slack message the MCP can
only post text to, and taking a Slack post back off the channel. Whenever a new gap shows
up it belongs here too, so treat these bins as a growing toolkit rather than a fixed pair
of tricks.

A growing set of commands is never a remembered one, so **discover it every run**:

1. `jira --help` and `slack --help` for the commands that exist right now.
2. `<bin> <command> --help` for that command's arguments and flags.

`--help` is generated from the code on disk, which makes it the single source of truth.
Anything carried over from an earlier session may already be stale. Read it before
composing an invocation, and again when a command surprises you. The commands are built to
compose, with `--json` on each and spinners on stderr, so they pipe into whatever comes
next.

## Requirements

Both bins come from one package, and both run on [Bun](https://bun.sh):

```bash
bun add -g @aabuhijleh/courier
```

If `jira` or `slack` is missing from PATH, stop and give the user that line rather than
working around it.

## Setup is a hand-off to the user

Each bin needs a credential only a human can create, from a browser page behind their own
login: an Atlassian API token for `jira`, a Slack app and bot token for `slack`. Both setup
commands are interactive prompts, and a prompt has no keyboard in your shell. Give the user
the line and wait:

```bash
jira setup     # Atlassian API token
slack setup    # Slack app, bot scopes, bot token
```

An unconfigured bin **exits 0 with no data**, even under `--json`. It draws its setup
prompt, reads end-of-input, and quits successfully. Read `No Jira config found`, `No Slack
config found`, or a `◆ ATLASSIAN_BASE_URL` or `◆ SLACK_BOT_TOKEN` line in the output as a
missing credential, not as an empty issue or an empty thread. Hand it over and stop. A
re-run lands in the same place.

Let the setup commands write the credential. A token typed into `config.json` by hand, or
passed on a command line, lands in shell history and in your transcript.

`jira config` and `slack config` print the path and what is saved, which is how you confirm
the hand-off landed. The file is `~/.config/abed-hub/courier/config.json`, mode 600.

## Jira descriptions carry more than markdown

A description with tickable checkboxes or a screenshot embedded in the body is written as
ADF at the REST API. The MCP's markdown conversion escapes checkboxes into literal text,
and no CLI command writes a description yet. The call, the media id Jira validates against,
and what its two opaque `400`s mean: [`jira-adf.md`](jira-adf.md).

## Slack acts as a bot

The `slack` bin authenticates as a bot user, which decides both what it can reach and how a
post lands. No flag gets past these:

- **Invited channels only.** `/invite @<bot>` in each channel, private ones included. Once
  invited it reads that channel's full history, including files posted before it joined. An
  error about Slack returning an HTML page means the bot is not in that channel, so invite
  it and retry.
- **Its own DMs only.** A `D…` link fails fast. Ask the reporter to repost in a channel.
- **Slack Docs and canvases hold no downloadable bytes.** Their content comes from the
  Slack MCP's canvas reader.
- **A post is authored by the bot**, carrying its name and avatar, with no
  `chat:write.customize` scope to dress it up as anyone else. When a human audience would
  read the message as coming from a person, get the author's sign-off on posting as the bot
  first.
- **It takes back its own posts, and only those.** `slack delete` removes a message the bot
  posted. A human's survives every token the app holds. Attached files outlive the message
  unless the delete is told to take them too. An audience may have read it either way, so
  rehearse an unfinished message in a sandbox channel the bot is already in.
- **Message text is mrkdwn, not markdown.** Use `*bold*` and `_italic_`, where `**bold**`
  posts literal asterisks. Files attach to the same message as the text, so a demo lands
  beside its explanation rather than in a message of its own.
- The app stays internal to the workspace. Public distribution throttles
  `conversations.history` and `.replies` to one request per minute, which makes the CLI
  unusable.

## When a gap isn't covered yet

`bun add -g` installs a built bundle, so the `dist/jira.js` on disk is not the source and
the next install overwrites an edit to it. The source is `packages/courier` in
[abed-hub](https://github.com/aabuhijleh/abed-hub), and a change there reaches this machine
only once the package is published again. Both put a gap in the user's hands:

1. Hand over the invocation you ran and its output verbatim, and name the capability that
   is missing.
2. Finish the rest of the task without it, and say which part you left undone.
