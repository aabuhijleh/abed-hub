---
name: gh-stack
description: >-
  Work with stacked pull requests through the `gh stack` extension: find a PR's stack,
  report and update what is stale, read each layer's checks, resolve conflicts, approve the
  stack, add a PR on top, split work into a stack, merge. Use whenever a PR or branch's base
  is not trunk, or for "stack", "PR on top of", "restack", "approve the stack".
license: MIT
allowed-tools: Bash(bash *gh-stack/status.sh*), Bash(bash *gh-stack/approve.sh*), Bash(bash *gh-stack/watch.sh*), Bash(gh stack view:*), Bash(gh stack init:*), Bash(gh stack add:*), Bash(gh stack submit:*), Bash(gh stack sync:*), Bash(gh stack rebase:*), Bash(gh stack push:*), Bash(gh stack link:*), Bash(gh stack checkout:*), Bash(gh stack up:*), Bash(gh stack down:*), Bash(gh stack top:*), Bash(gh stack bottom:*), Bash(gh stack trunk:*), Bash(gh pr view:*), Bash(gh pr checks:*), Bash(gh pr edit:*), Bash(gh run rerun:*), Bash(git status:*), Bash(git log:*), Bash(git add:*)
---

# Stacked pull requests

`gh stack` chains branches so each PR targets the one below it, and links them into a
stack on GitHub. Install it with `gh extension install github/gh-stack`.

## Start with the status report

GitHub holds the stack. The local tracking that `gh stack view` reads exists only after
this checkout ran `init` or `checkout` for it, so `view` saying "not part of a stack" says
nothing about GitHub. Before any work on a PR or branch whose base is not trunk, and for
every status or update request, run it from inside the repo's checkout:

```bash
bash <skill-dir>/status.sh [pr-number | pr-url | branch]   # current branch by default
```

It prints a table of the stack bottom to top, with the target PR marked 👉: each PR's
position, whether it is behind trunk and behind its base, its checks, and its merge state.
Verdict lines follow: up to date with trunk, with each base, checks passing (every failing
check by PR), and 💥 conflicts. The last line is a 💡 suggested update or ✨ "Nothing to
update". Exit 2 means the PR is in no
stack on GitHub; a PR based on another branch is then a hand-built chain, which
`gh stack link <bottom> ... <top>` turns into a stack.

Your answer to a status or update request opens with the whole report verbatim inside a
` ```text ` block, every line, emoji, and row in printed order, since the columns line up
only in monospace. After the block, give the verdict in a sentence or two. When anything is stale, end with
the suggested update and offer to run it.

## Keep the stack current

The stack is current when every open PR contains trunk and its base, has no conflicts, and
its required checks are green. Run the update when the user asks for it, or says yes to the
suggestion:

1. If the suggestion starts with `gh stack checkout <stack-number>`, run that first.
2. `gh stack sync`: fetch, fast-forward trunk, rebase each layer onto the one below, push.
   A squash-merged or merged lower PR is detected and replayed past; `--prune` deletes its
   local branch. Exit 3 is a conflict: resolve it as [Conflicts](#conflicts) says.
3. Rerun `status.sh` and show it. That is the proof the sync landed: `sync` exits 0 with
   "Sync aborted" when the local and GitHub stacks diverge and no terminal can prompt.
   Hand that case to the user to run `gh stack sync` themselves.
4. Watch the pushed checks until they settle. When that report shows ⏳ or a `✅ 0 passed`
   layer, whose checks GitHub has yet to queue, start this in the background and answer
   with the report from step 3, saying you will report back once the checks settle:

   ```bash
   bash <skill-dir>/watch.sh [pr-number | pr-url | branch]   # same target as status.sh
   ```

   It reruns `status.sh` every 30 seconds and prints only the settled report: no ⏳ left,
   and a layer with no checks given a minute to get some. When it exits, send that report
   as a new message, shown the way any report is, with the verdict on which checks
   passed and which failed. Exit 124 means checks were still running after 30 minutes;
   show that last report and offer to keep watching. `--interval`, `--timeout`, and
   `--grace` take seconds.

Update layers only through `sync` or `rebase`. `gh pr update-branch` and the "Update
branch" button move one layer and leave the ones above it on the old commit.

## Checks

Only required checks gate a merge. Report a failing optional check as a warning and carry
on. For a failing required check, finish the task, then report the PR, the check name,
and the way forward:

- `gh pr checks <pr> --required` shows it, with the run link. Exit 1 there means a check
  failed and exit 8 means checks are pending; neither is a failure of the command.
- `gh run rerun <run-id> --failed` retries a flake.
- A real failure gets fixed on the layer that introduced it, then `gh stack sync` carries
  the fix up the stack.
- `watch.sh` waits on checks still running after a push, as step 4 of
  [Keep the stack current](#keep-the-stack-current) says.

The report's "Blocked by a review or repo rule" means required checks are green and the
merge waits on a reviewer or a ruleset, which is the user's to handle.

## One PR is the default

Stack when the work is genuinely a chain: a later branch needs an earlier branch's code,
and cutting them apart is what makes each one reviewable. Two branches that could merge in
either order are two PRs. A stack costs a rebase cascade on every trunk move and costs the
reviewer an ordering to hold in their head. Ask before starting one the user did not ask
for.

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

The other prompts: `init` and `add` without a branch name, `add` on a branch outside a
stack, `add -A` or `-u` without `-m`, and `init`'s first run in a repo, which asks to turn
on rerere. Name the branch, pass `-m`, and run `git config rerere.enabled true` before
`init`.

## Build or grow a stack

```bash
gh stack init <existing-branch> <new-branch>   # bottom to top; adopts what exists
gh stack add <next-branch>                     # only from the top branch, clean tree
gh stack submit --auto --open                  # push, open the PRs, link the stack
```

To add a PR on top of a stack that lives on GitHub: `gh stack checkout <stack-number>`,
`gh stack top`, `gh stack add <branch>`, commit, `gh stack submit --auto --open`. When the
PRs are already open and only the stack is missing, `gh stack link <pr> <pr>` builds it on
GitHub and writes no local state.

**`--auto` creates every PR as a draft unless `--open` is passed**, and its title is the
commit subject for a one-commit branch and the branch name otherwise. That is a
placeholder. Write the real title and body with the repo's PR template, or the `pr` skill
where there is none, and set them with `gh pr edit <pr> --title <title> --body-file <file>`.

## Conflicts

The report flags conflicts before you sync: 💥 marks a layer that conflicts with its base
now, or with trunk once synced, and "💥 Conflicts" lists each one's files. `sync` restores
every branch when it hits a conflict and exits 3. Resolve it yourself:

```bash
gh stack rebase              # stops on the conflict and lists the files
# resolve each file, keeping both sides' intent, git add it, then:
gh stack rebase --continue   # repeat until it exits 0; --abort puts every branch back
gh stack push                # rebase never pushes; this updates every PR
```

Then rerun the report. Ask the user only when the right resolution is unclear. Until
`--continue` or `--abort` runs, every other command fails with exit 7. An interrupted
`modify` takes the same two flags and blocks with exit 10.

## Approve the stack

When the user asks to approve the stack, approve its PRs as the user:

```bash
bash <skill-dir>/approve.sh [pr-number | pr-url | branch] [--dry-run]
```

It approves, in one batched mutation, every open non-draft PR the user neither authored nor
already approved. It lists the user's own PRs and leaves them alone, since GitHub refuses
self-approval. The request to approve is the go-ahead; a status-only request gets
`--dry-run` at most. Show its output in a ` ```text ` block.

## Confirm before these

`merge` and `unstack` reach GitHub and no local command takes them back. `merge` lands
every PR from the bottom up to the one you name, reusing the last merge method unless
`--squash`, `--merge`, or `--rebase` says otherwise. GitHub Docs note that a merge can stop
partway with the PRs below the failure merged, and a merge queue may land them in separate
groups. `unstack` deletes the stack on GitHub; `unstack --local` drops only local tracking.
Get the user's word first, echoing back which PRs are in scope and which method will run.

## Exit codes

| | |
|---|---|
| 0 | Success |
| 1 | Generic failure |
| 2 | Not in a stack, or no such stack |
| 3 | Rebase conflict |
| 4 | GitHub API failure. Before v0.2.1 an SSH host alias in the remote landed here; `GH_REPO=owner/repo` gets past it |
| 5 | Bad arguments or flags |
| 6 | Ambiguous: the branch is in several stacks, or several remotes and none chosen. Check out a branch unique to one stack, or set `remote.pushDefault` |
| 7 | A rebase is already in progress |
| 8 | Another process holds the stack lock |
| 9 | Stacked pull requests are off for this repo |
| 10 | Modify session interrupted; `--continue` or `--abort` first |

## Flags

Every flag list lives in `gh stack <command> --help`, and this extension moves fast. Read
it there instead of guessing.
