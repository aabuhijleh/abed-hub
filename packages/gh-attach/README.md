# @aabuhijleh/gh-attach

Screenshots a page to a PNG sized for GitHub, ready to attach to a pull request or issue.

```bash
gh-attach shot ./page.html ./out.png --width 948
# wrote ./out.png (1896x898 px, 2x of 948css)
```

948px is the default width because it lands at GitHub's 900px render width with no
downscaling. The shot is cropped to the page's content, so a short page does not come back
padded with blank space.

Uploading is [`gh`'s job](https://cli.github.com) since 2.99.0. `gh pr comment 12 --attach
./out.png` uploads and embeds in one command, against the token `gh` already holds. This
package used to do that too, through a browser session cookie, back when GitHub had no
upload API you could reach with a token. That is gone, and so is the cookie.

## Prerequisites

[Bun](https://bun.sh), and a browser for `shot`. Playwright is a prerequisite you install
yourself rather than a dependency of this package:

```bash
bun add -g @aabuhijleh/gh-attach
bun add -g @playwright/cli
playwright-cli install-browser chromium   # only if no chromium build is installed yet
```

macOS is the tested platform. Linux and WSL work.

## Commands

| Command | What it does |
| --- | --- |
| `gh-attach shot <page.html\|url> <out.png> [--width 948]` | Screenshot a page to a PNG at 2x, cropped to its content. |

## Develop

```bash
bun install
bunx tsc --noEmit
bun run build
```
