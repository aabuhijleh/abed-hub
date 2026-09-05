---
name: gh-stack
description: >-
  Split work into a chain of dependent pull requests with the `gh stack` extension.
  Use for "stack these PRs", "open a PR on top of this branch", "base this PR on my
  other PR", or when a branch's PR depends on one that has not merged yet.
license: MIT
allowed-tools: Bash(gh stack view:*), Bash(gh stack init:*), Bash(gh stack add:*), Bash(gh stack submit:*), Bash(gh stack sync:*), Bash(gh stack rebase:*), Bash(gh stack push:*), Bash(gh stack link:*), Bash(gh stack checkout:*), Bash(gh stack up:*), Bash(gh stack down:*), Bash(gh stack top:*), Bash(gh stack bottom:*), Bash(gh stack trunk:*), Bash(gh pr edit:*), Bash(git status:*), Bash(git log:*)
---

# Stacked pull requests

`gh stack` chains branches so each PR targets the one below it, then links them into a
stack on GitHub. Install it with `gh extension install github/gh-stack`. The feature is in
public preview and a repo can have it switched off.

## One PR is the default

Stack when the work is genuinely a chain: a later branch needs an earlier branch's code,
and cutting them apart is what makes each one reviewable. Two branches that could merge in
either order are two PRs, not a stack. A stack costs the author a rebase cascade on every
trunk move and costs the reviewer an ordering to hold in their head, so charge that only
when the chain is real. Ask before starting one the user did not ask for.

## The TUI trap

Half of `gh stack` opens a full-screen TUI and waits for `Ctrl+S`. Under a pty, which some
agent harnesses allocate, that is a hang with no output. Pass the escape rather than
trusting the terminal to be detected as non-interactive.

| Instead of | Run |
|---|---|
| `gh stack submit` | `gh stack submit --auto` |
| `gh stack merge` | `gh stack merge --yes` |
| `gh stack view` | `gh stack view --json`, or `--short` |
| `gh stack checkout` | `gh stack checkout <stack-number \| pr-number \| branch>` |
| `gh stack modify`, `gh stack switch` | Nothing. Hand both to the user. |

`init` and `add` prompt only when the branch name is missing, so name the branch.

## The loop

```bash
gh stack init <existing-branch> <new-branch>   # adopts what exists, creates what does not
gh stack add <next-branch>                     # only from the top branch, clean tree
gh stack submit --auto --open                  # push, open the PRs, link the stack
gh stack sync                                  # after trunk moves
gh stack merge --yes                           # bottom-up, all or nothing
```

`init` takes branches bottom to top and adopts any that already exist, which is how a
branch you are already on becomes the bottom of a new stack. When the PRs are already open
and all you want is the stack, `gh stack link <pr> <pr>` builds it on GitHub and writes no
local state.

**`--auto` creates every PR as a draft unless `--open` is passed**, and fills the title
from the commit subject and the body from the commits. That is a placeholder, not a
description. Write the real ones with `writing-great-prs` and set them afterwards with
`gh pr edit <pr> --title <title> --body-file <file>`.

## When trunk moves

`sync` is the routine path: fetch, fast-forward trunk, cascade-rebase every branch, push,
relink. It restores every branch and stops if it hits a conflict, so it never leaves a
half-rebased stack behind.

The conflict itself is `gh stack rebase`'s job, and it needs a human at the keyboard:

```bash
gh stack rebase              # pauses on conflict, prints the conflicted files
# resolve, git add, then:
gh stack rebase --continue   # or --abort, which puts every branch back
```

`gh stack modify` takes the same two flags for an interrupted modify session. Until one of
them runs, everything else fails with exit 7 or 10.

## Confirm before these

`merge` and `unstack` reach GitHub and no local command takes them back. `merge` lands
every PR from the bottom of the stack up to the one you name, in a single all-or-nothing
operation, so naming the top PR merges all of them, and it reuses whatever merge method ran
last unless `--squash`, `--merge`, or `--rebase` says otherwise. `unstack` deletes the stack
object on GitHub. Get the user's word first, echoing back which PRs are in scope and which
method will run.

## Exit codes

| | |
|---|---|
| 0 | Success |
| 1 | Generic failure |
| 2 | Not in a stack, or no such stack |
| 3 | Rebase conflict |
| 4 | GitHub API failure. An SSH host alias in the remote lands here; `GH_REPO=owner/repo` gets past it |
| 5 | Bad arguments or flags |
| 6 | Branch is in several stacks; pass a stack or PR number |
| 7 | A rebase is already in progress |
| 8 | Another process holds the stack lock |
| 9 | Stacked pull requests are off for this repo |
| 10 | Modify session interrupted; `--continue` or `--abort` first |

## Flags

Every flag list lives in `gh stack <command> --help`, and this extension is young enough
that it moves. Read it there instead of guessing.
