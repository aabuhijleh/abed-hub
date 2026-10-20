# Is the gh-stack skill up to date and useful?

Researched 2026-10-20 against `github/gh-stack` v0.2.1 (main at `29a36d3`) and GitHub Docs.

## Verdict

The skill is partly stale and now has an official replacement. GitHub made stacked PRs generally available on 2026-10-06, and the extension ships its own agent skill, also named `gh-stack`. That skill covers every flow this one covers, plus squash merges, divergence, restructuring, worktrees, multiple remotes, and merge queues. The hub skill still has two things the official one lacks: the "one PR is the default" guidance and the step that rewrites placeholder PR titles and bodies with the `pr` skill. Its core loop and TUI table are still correct. Its preview claim, its SSH-alias note, its rule about which commands prompt, and its "a human must resolve conflicts" rule are out of date or wrong.

Recommendation: retire the hand-written body and register the official skill as a fork in `FORKS`, with the two hub-specific sections added as patches. If that is too much, apply the edits under [Recommended edits](#recommended-edits).

## Where the skill comes from

- The hub wrote this skill itself. It is not a third-party copy. The registry lists it as `{ name: "gh-stack", repo: HUB, dir: "skills" }` (`packages/abed-hub/src/lib/registry.ts:95-100`), and `scripts/lib/forks.ts` lists only `deslop` in `FORKS`.
- `~/.claude/skills/gh-stack` links to `~/.agents/skills/gh-stack`. `diff -r` shows that copy is the same as `skills/gh-stack` in this repo, so no hub update is pending.
- It targets `github/gh-stack`. The setup line is in `skills/gh-stack/SKILL.md:14`, and doctor checks `gh extension list` for `github/gh-stack` (`packages/abed-hub/src/lib/tools.ts:86-111`).
- The extension is active and not archived. The repo was last pushed 2026-10-19, and the latest release is v0.2.1 from 2026-10-09 (`gh repo view github/gh-stack`, `gh release list -R github/gh-stack`). The local install is `gh stack version 0.2.1`, the latest release.
- The skill was written on 2026-09-05 (commit `3df0d59`) against v0.1.1 or earlier. Since then, v0.2.0 (2026-10-02) and v0.2.1 (2026-10-09) have shipped.

## Stale or wrong claims

| # | Skill says | Current fact | Source |
|---|---|---|---|
| 1 | "The feature is in public preview and a repo can have it switched off." (`SKILL.md:14-15`) | GA since 2026-10-06 on all github.com plans. GHES support comes in a later release. GitHub Docs say stacked PRs "require no setup or enablement". Exit 9 still exists, but its meaning is now "not available for this repository" (for example GHES), not a toggle in preview. | [GA changelog](https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available/), [Roll out stacked PRs](https://docs.github.com/en/pull-requests/tutorials/roll-out-stacked-prs), [`cmd/utils.go:36`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/cmd/utils.go#L36) |
| 2 | Exit 4: "An SSH host alias in the remote lands here; `GH_REPO=owner/repo` gets past it" (`SKILL.md:95`) | v0.2.1 fixed this. The extension now expands the alias before it matches remotes to a host. The workaround is only needed on v0.2.0 or earlier. | [v0.2.1 release notes](https://github.com/github/gh-stack/releases/tag/v0.2.1), PR [#554](https://github.com/github/gh-stack/pull/554) |
| 3 | "`init` and `add` prompt only when the branch name is missing" (`SKILL.md:39`) | There are more prompts now. On the first run in a repo, `init` asks to enable `git rerere`. `add` on a branch outside a stack offers to create a stack (v0.1.1). `add -A` or `add -u` without `-m` opens an editor. With a TTY, any of these can block. | [`cmd/init.go:84-85`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/cmd/init.go#L84-L85), [`cmd/add.go:304-329`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/cmd/add.go#L304-L329), `gh stack add --help`, [upstream `commands.md:34-35`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/references/commands.md#L34-L35) |
| 4 | The conflict "needs a human at the keyboard" (`SKILL.md:67`) | `gh stack rebase` stops, lists the conflicted files, and waits. Then anyone, an agent included, can resolve the files, run `git add`, and run `--continue`. The official skill tells the agent to do this. Only `modify` is TUI-only. | [upstream `SKILL.md:161-166`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/SKILL.md#L161-L166), [Troubleshooting stacked PRs](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-stacked-pull-requests) |
| 5 | `--auto` "fills the title from the commit subject and the body from the commits" (`SKILL.md:56-57`) | That is true only when a branch has one commit. When a branch has several commits, the title is the branch name with hyphens and underscores changed to spaces. Also, `--open` marks existing PRs ready for review, not only new ones. | [upstream `commands.md:72-76`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/references/commands.md#L72-L76), `gh stack submit --help` |
| 6 | Exit 6: "pass a stack or PR number" (`SKILL.md:97`) | Exit 6 also means "multiple remotes, can't auto-select". `sync`, `rebase`, `submit`, and `push` take no stack number. The fix is to check out a branch that is in only one stack, or to pass `--remote` or set `remote.pushDefault`. Only `merge` and `unstack` accept a stack number. | [`cmd/utils.go:33`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/cmd/utils.go#L33), [upstream `troubleshooting.md:115-125`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/references/troubleshooting.md#L115-L125) |
| 7 | `sync` does "fetch, fast-forward trunk, cascade-rebase every branch, push, relink" (`SKILL.md:63-64`) | `sync` now also reconciles with the stack on GitHub first. If the local and remote stacks have diverged and there is no TTY, it changes nothing and **exits 0** with `Sync aborted`. If there is a TTY, it prompts. An exit code of 0 does not show that the sync ran. | `gh stack sync --help`, [upstream `troubleshooting.md:51-58`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/references/troubleshooting.md#L51-L58) |
| 8 | `merge` is "a single all-or-nothing operation" (`SKILL.md:81-82`) | The CLI help and the official skill still say this. But GitHub Docs describe a merge that stops partway: "Pull requests below the failure stay merged." With a merge queue, PRs can also land in separate groups, and any method flag is ignored. Tell the user both cases before confirming. | `gh stack merge --help`, [Troubleshooting stacked PRs](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-stacked-pull-requests), [upstream `commands.md:181-184`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/references/commands.md#L181-L184) |
| 9 | "`unstack` deletes the stack object on GitHub" (`SKILL.md:83-84`) | This is correct, but it is missing the safe option. `unstack --local` removes only local tracking and never contacts GitHub. PRs and branches always survive, and PRs that are queued or have auto-merge on stay stacked. `delete` is an alias. | `gh stack unstack --help` |

The hub `README.md:127-128` repeats claim 1 ("in public preview ... every `gh stack` command exits 9"). Fix it in the same change as the skill (see the Docs sync list in `CLAUDE.md`).

Still correct: the exit code numbers 0 to 10 (`cmd/utils.go:25-37`); the TUI table for `submit`, `merge`, `view`, `checkout`, `modify`, and `switch`; `init` adopting existing branches from bottom to top; `add` only from the top branch, which otherwise exits 5 (`cmd/add.go:104-106`); `link` writing no local state; the rule that `merge` reuses the last-used method; and `--auto` creating drafts unless `--open` is passed. These checks used `gh stack <cmd> --help` on v0.2.1.

## Gaps

The upstream skill or GitHub Docs cover each of these. The hub skill does not.

1. **Squash merges and a merged base.** The skill does not say that `sync` and `rebase` detect a merged parent and replay with `--onto`, so a squash-merged parent needs no manual work. It also does not say that `sync --prune` deletes local branches for merged PRs. ([upstream `troubleshooting.md:33-49`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/references/troubleshooting.md#L33-L49), [GitHub FAQ on squash merge](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/docs/src/content/docs/faq.md#L196-L232))
2. **Conflict after `sync`.** `sync` restores every branch before it exits 3. The agent must run `gh stack rebase` to bring the conflict back, then resolve it. The skill hints at this but gives no steps. ([upstream `SKILL.md:165-166`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/SKILL.md#L165-L166))
3. **Editing a lower layer.** The skill does not cover how to check out the branch that owns a change, commit, run `gh stack rebase --upstack`, then return with `gh stack top`. This is the most common change after review. ([upstream `SKILL.md:69-84`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/SKILL.md#L69-L84))
4. **Reorder or remove a layer.** The skill says to hand `modify` to the user. The official skill gives a path an agent can run: `unstack`, rewrite ancestry with `git rebase --onto`, then `init --base <trunk> ...` and `submit --auto`. ([upstream `troubleshooting.md:80-113`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/references/troubleshooting.md#L80-L113))
5. **Multiple remotes.** Without `remote.pushDefault` or `--remote`, the result is exit 6 or the wrong remote. `checkout` and `trunk` have no `--remote` flag. ([upstream `SKILL.md:46-48`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/SKILL.md#L46-L48))
6. **Navigation and reading state.** The skill does not cover `up`, `down`, `top`, and `bottom` (which never prompt), the `view --json` schema (`needsRebase`, `isMerged`, `pr.state`), or `--print-path` for worktrees. Worktree support is new in v0.2.0. ([v0.2.0 release notes](https://github.com/github/gh-stack/releases/tag/v0.2.0), [upstream `SKILL.md:129-143`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/SKILL.md#L129-L143))
7. **Checking out someone else's stack.** The skill does not say that `checkout <pr-url | branch>` imports a remote stack (v0.1.1). It also does not say that a local stack in the way needs `unstack --local` first. (`gh stack checkout --help`)
8. **`rerere`.** `init` turns it on, and with a TTY it asks first. Setting `git config rerere.enabled true` before `init` skips the prompt and replays repeated conflicts on each layer. ([upstream `commands.md:34-35`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/references/commands.md#L34-L35))
9. **`push` vs `submit`.** The skill does not say that `push` is not atomic and never touches PRs, or that `submit` on a fully merged stack makes a new stack. ([upstream `commands.md:52-71`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/references/commands.md#L52-L71))
10. **Upgrade notices.** Since v0.2.0, the extension prints upgrade notices to stderr. `GH_STACK_NO_UPDATE_NOTIFIER=1` turns them off. stdout and exit codes do not change. ([v0.2.0 release notes](https://github.com/github/gh-stack/releases/tag/v0.2.0))
11. **Triggers.** The description triggers only when a stack is created. It misses requests to maintain a stack: "sync my stack", "my base PR merged", "rebase the stack", "merge the stack", "check out PR 42's stack". The official description lists "creation, viewing, edits, push, submit, sync, rebase, merge, or checkout" and "when a stack is checked out". ([upstream `SKILL.md:3-7`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/SKILL.md#L3-L7))
12. **`allowed-tools`.** The list leaves out `git add` and `git commit`, which every loop needs. It also leaves out `gh stack unstack --local`, which is safe because it is local only.

## Name collision with the official skill

The extension README now says to run `gh skill install github/gh-stack` for agent support ([README "AI agent integration"](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/README.md#L46-L52)). That skill is also named `gh-stack` (version `0.2.0` in its metadata). v0.1.1 cut it to about 183 lines with references that load on demand ([v0.1.1 release notes](https://github.com/github/gh-stack/releases/tag/v0.1.1)). A user who follows the extension's README and also installs the hub skill gets two skills with the same name and conflicting guidance. One example is item 4 in the table above.

The extension is not abandoned or replaced. It is GitHub's official CLI for the feature ([GitHub Docs CLI reference](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands)). Other tools (jj, Sapling, git-town, ghstack) are supported only through `gh stack link` and are not a reason to switch.

## Recommended edits

Option A is the better one. Use option B if a fork is too much work.

**A. Fork the official skill.**

1. Copy `skills/gh-stack/SKILL.md` and `references/*.md` from `github/gh-stack` into `skills/gh-stack/`. Add a `FORKS` entry in `scripts/lib/forks.ts` with `repo: "github/gh-stack"` and `path: "skills/gh-stack/SKILL.md"`. Add `metadata.credits` and a `CREDITS.md` with the MIT notice, as `deslop` does. Check whether `forks.ts` and `skills:sync` handle `references/` files, or extend them to.
2. Add two patches: the "One PR is the default" section (current `SKILL.md:17-23`), and the paragraph that rewrites `--auto` titles and bodies with the repo template or the `pr` skill and `gh pr edit` (current `SKILL.md:56-59`).
3. Keep the hub frontmatter, but widen the description to cover maintenance requests (gap 11). For example: "Create and maintain a chain of dependent pull requests with the `gh stack` extension. Use to stack PRs, open a PR on top of another branch, sync or rebase a stack after its base merges, edit a lower layer, merge a stack, or check out someone's stack."
4. Update `README.md:93-128` to drop the preview sentence. Change the "ten exit codes" pitch to say the skill follows GitHub's skill and adds the two extra sections.

**B. Patch the current skill in place.**

1. Change line 14-15 to: "Stacked PRs are generally available on github.com. Exit 9 means the repo or host does not support them (for example GitHub Enterprise Server)."
2. Change exit 4 to "Check `gh auth status`, then retry". Move the SSH-alias note to "v0.2.0 and earlier only", or delete it, since doctor already reports an outdated extension.
3. Change line 39 to name all the prompts: `init` with no names or on the first `rerere` prompt (run `git config rerere.enabled true` first), `add` with no name, `add` outside a stack, and `add -A` or `-u` without `-m`.
4. Rewrite "When trunk moves". On exit 3 from `sync`, run `gh stack rebase`, resolve the listed files, `git add`, then `gh stack rebase --continue` until it exits 0. Ask the user only when the right resolution is unclear. Add squash-merge handling, `--prune`, and the `Sync aborted` with exit 0 check.
5. Add an "Edit a lower layer" block that uses `checkout` or `down`, commit, `rebase --upstack`, `top`, and `push`.
6. Add the reorder recipe that uses `unstack` and `init --base` in place of "hand `modify` to the user".
7. Fix the `--auto` title rule (claim 5) and the exit 6 meaning (claim 6). Add the multiple-remotes rule.
8. Under "Confirm before these", add the merge queue case and the partial merge that GitHub Docs describe. Name `unstack --local` as the safe local-only option.
9. Widen the description (gap 11). Add `Bash(git add:*)`, `Bash(git commit:*)`, and `Bash(gh stack unstack --local:*)` to `allowed-tools`.
10. Fix `README.md:127-128` in the same change.

## Sources

Local:

- `skills/gh-stack/SKILL.md` (lines cited above). It is the same as `~/.agents/skills/gh-stack/SKILL.md` (`diff -r`).
- `packages/abed-hub/src/lib/registry.ts:95-100`, `packages/abed-hub/src/lib/tools.ts:86-111`, `scripts/lib/forks.ts`, `README.md:93-128`
- `gh extension list` shows `github/gh-stack v0.2.1`. `gh stack --version` shows `0.2.1`. `gh --version` shows `2.102.0`.
- `gh stack --help`, and `--help` for `init`, `add`, `submit`, `sync`, `rebase`, `merge`, `view`, `checkout`, `link`, `unstack`, `push`, and `modify` (v0.2.1)
- `git log -- skills/gh-stack` (commits `3df0d59` on 2026-09-05 and `217acc1` on 2026-10-01)

Upstream `github/gh-stack` at [`29a36d3`](https://github.com/github/gh-stack/tree/29a36d314be664583705f18e41cebdf2b61ad514):

- [`skills/gh-stack/SKILL.md`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/SKILL.md), [`references/commands.md`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/references/commands.md), [`references/troubleshooting.md`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/references/troubleshooting.md), [`references/stack-design.md`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/skills/gh-stack/references/stack-design.md)
- [`cmd/utils.go`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/cmd/utils.go#L25-L37), [`cmd/add.go`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/cmd/add.go), [`cmd/init.go`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/cmd/init.go)
- [`README.md`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/README.md), [`docs/.../faq.md`](https://github.com/github/gh-stack/blob/29a36d314be664583705f18e41cebdf2b61ad514/docs/src/content/docs/faq.md)
- Releases: [v0.2.1](https://github.com/github/gh-stack/releases/tag/v0.2.1), [v0.2.0](https://github.com/github/gh-stack/releases/tag/v0.2.0), [v0.1.1](https://github.com/github/gh-stack/releases/tag/v0.1.1)

GitHub:

- [Stacked pull requests generally available (2026-10-06)](https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available/)
- [Stacked pull requests are now in public preview (2026-07-30)](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/)
- [About stacked pull requests](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs)
- [Roll out stacked pull requests to your organization](https://docs.github.com/en/pull-requests/tutorials/roll-out-stacked-prs)
- [Stacked pull requests CLI commands](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands)
- [Troubleshooting stacked pull requests](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-stacked-pull-requests)
