# @aabuhijleh/courier

Carries files between Slack and Jira from the command line, and reads both. One package,
two bins.

`jira` reads an issue and downloads its attachments, and uploads files to it.

`slack` reads a thread verbatim, downloads every file on it, posts as the bot, and takes
its own posts back.

The whole round trip for filing a report:

```bash
slack pull <slack-permalink> --out ./evidence   # the thread's files, descriptively named
jira attach ABC-123 ./evidence/*
```

## Prerequisites

[Bun](https://bun.sh). macOS and Linux are supported. On Windows, use WSL.

## Install

```bash
bun add -g @aabuhijleh/courier
```

## Setup

```bash
jira setup    # walks through creating an Atlassian API token
slack setup   # walks through creating a Slack app, then validates the bot token
```

`slack setup` prints the bot scopes to add before it asks for the token: `channels:history`,
`channels:read`, `chat:write`, `files:read`, `files:write`, `groups:history`, `groups:read`,
`users:read`.

Both write one section of `~/.config/abed-hub/courier/config.json`, or under
`$XDG_CONFIG_HOME` when that is set. The file holds live API tokens, so it is written mode
600 inside a mode 700 directory: your user account can read and write it, and no other
account on the machine can read it or list the directory. Run `jira config` or
`slack config` to print the path and the saved settings.

## Commands

| Command | What it does |
| --- | --- |
| `jira show <key\|url>` | Print the issue and download its attachments. |
| `jira attach <key> <files…>` | Upload files as attachments to the issue. |
| `jira config [--reveal]` | Print the config path and contents. |
| `jira setup` | Save Atlassian credentials, or replace an expired token. |
| `slack thread <link>` | Print the thread verbatim, with its files and permalink. |
| `slack pull <link> [--out dir]` | Download every file on the thread. |
| `slack post <channel\|link> [files…] -m <text>` | Post a message to a channel or thread, files on the same message. |
| `slack delete <link…> [--files]` | Delete a message the bot posted, and with `--files` the files it carried. |
| `slack permalink <channel> <ts>` | Print the canonical permalink. |
| `slack config [--reveal]` | Print the config path and the saved settings. |
| `slack setup` | Create the Slack app if needed, then save and validate its bot token. |

Leave a positional off and the command prompts for it. `--help` on any command is
generated from the code, so trust it over this table. Every command takes `--json`, and
spinners go to stderr, so stdout stays pipeable.

## Slack bot limits

The `slack` bin uses a bot token, which means:

- The bot only sees channels it has been invited to. Run `/invite @<bot>` in each one,
  private included. Once invited it can read the channel's full history, including files
  posted before it joined.
- Human-to-human DMs are unreadable. `slack thread` fails fast on a `D…` conversation. Ask
  the reporter to repost in a channel.
- Slack Docs and canvases are not uploaded files and have no bytes to download. `slack pull`
  skips them with a warning rather than saving Slack's HTML page as if it were evidence.
- Never enable public distribution on the Slack app. It drops `conversations.history` and
  `.replies` to one request per minute.

## Develop

```bash
bun install
bun test
bunx tsc --noEmit
bun run build
```
