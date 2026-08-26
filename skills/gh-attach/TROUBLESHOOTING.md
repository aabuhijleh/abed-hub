# gh-attach troubleshooting

You are here because `gh-attach upload` failed twice. Everything below assumes you went
through `gh-attach`. Reaching `gh image` any other way is itself the bug.

## Why a cookie goes stale, and why a naive gate misses it

`gh image` resolves its cookie in this order: `--token`, then `GH_SESSION_TOKEN`, then the
browser store. So an exported `GH_SESSION_TOKEN` wins. A long-running process, meaning an
agent session, an IDE, or a tmux server, snapshots that variable at launch, and nothing
can change it for the life of that process. The variable outlives the cookie it holds
while the token file is refreshed underneath it.

That produces a **false pass**: a gate validates the variable, rotates, writes a fresh
cookie to the file, validates that, and exits 0, while the upload goes out with the frozen
one. `gh-attach` closes it two ways. It validates the **file**, which is the source of
truth. And it reads the file at call time and passes it to one process, so the ambient
variable never participates.

`uploadToken not found on repo page` is what GitHub's answer looks like through the
extension. A dead cookie gets a logged-out repo page, that page has no `uploadToken`, and
the extension cannot tell that from an unauthorized one, so it prints every possibility it
can think of. Read the whole line as **stale** and act on that.

## Already ruled out

The line's own speculation, and the theories it invites, cost a long investigation once.
Each was tested:

| Theory | What the test showed |
|---|---|
| Write access | Read access uploads fine. A branch push to the same repo succeeded in the same session. |
| SAML SSO | The SSO sentence is static text in the error string. It appears verbatim for a personal namespace, which cannot enforce SSO. |
| Wrong account | `gh-attach token` prints the cookie's username. Compare it to `gh auth status` before believing this. It matched all along. |
| The file itself | The failure is at step 0, before any file is read. Size and dimensions are irrelevant. |

Confirm the cookie is live and current and you have the answer. `gh-attach` does exactly
that on every run.

## The two credentials

`gh image` tries the **`gh` CLI token** first, which covers images and video in any repo
you can push to. It falls back to a **`user_session` cookie** for other file types and for
repos you cannot push to. The cookie is the part that expires, every few weeks, and the
part `gh-attach` manages. A valid cookie means every upload path is open, so a passing
check is more credential than most uploads need.

`gh-attach` passes the file's contents as `GH_SESSION_TOKEN` to one process. That beats
`--token`, which is visible in `ps aux`.

## Where things live

| Piece | Path |
|---|---|
| The command | `gh-attach`, from `@abed-hub/gh-attach` |
| The cookie, mode 600, source of truth | `~/.config/abed-hub/gh-attach/token` |

There is no scheduler and no background job. `gh-attach` checks the cookie on every run
and re-extracts when it is dead, so the only cost of an expired cookie is a few seconds on
the next upload.

Extraction reads the browser cookie store, which on macOS needs the *Chrome Safe Storage*
Keychain item. Granting it **Always Allow** for the `gh-image` binary makes extraction run
without a prompt. Two consequences: the Keychain is only reachable from a logged-in
desktop session, so this cannot work over plain SSH or in CI, and upgrading the extension
can reset the grant, because macOS keys it to the requesting binary.

Check the credential directly:

```bash
gh-attach token           # validate, rotating only if the stored cookie is dead
gh-attach token --force   # re-extract from the browser unconditionally
```

## Other failures

| Symptom | Fix |
|---|---|
| `Sign in to github.com in your browser, then try again` | The browser session ended, so there is no cookie to extract. The user signs in, then re-runs. |
| `extract-token timed out` | Usually follows a `gh extension upgrade` that reset the Keychain grant. The user re-grants it once, below. |
| `warning: this shell's inherited GH_SESSION_TOKEN is stale` | Progress, not a failure. `gh-attach` reads the file, so the upload is unaffected. Carry on and say nothing about it. |
| Uploads land on the wrong account, or a repo you can see 404s | Several accounts can be authed at once, and `gh auth status` marks one "Active account". The CLI-token path uses the active one while the cookie belongs to whichever account the browser holds, so the two can genuinely disagree. Establish the disagreement first with `gh-attach token`, then `gh auth switch --user <login>` and re-run. |
| Hangs, and macOS shows a *security wants to use … Chrome Safe Storage* dialog | The Keychain grant is gone. Kill the run, because each retry queues another dialog, then re-grant below. |
| Windows and Chrome 127+ | A cookie-library limitation. Use another browser, or write the cookie to `~/.config/abed-hub/gh-attach/token` directly. |
| CI or headless | No browser and no Keychain, so extraction cannot work. Write a dedicated bot account's cookie to `~/.config/abed-hub/gh-attach/token`. |

## Re-granting Keychain access

Needed only when the grant is revoked. The user runs this themselves, because it opens a
dialog they have to answer. In Claude Code, `!` runs it in place:

```bash
gh-attach token --force
```

Tell them the dialog needs the **login-keychain password typed into the field first**,
then **Always Allow**. Denying, or clicking Always Allow on an empty field, fails, and the
next run prompts again. Always Allow is what makes it a one-time step.
