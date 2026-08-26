#!/usr/bin/env bash
# Installs the abed-hub tools and skills.
#
#   curl -fsSL https://raw.githubusercontent.com/aabuhijleh/abed-hub/main/setup.sh | bash
#
# Safe to re-run: every step checks for its own result first and skips if it is
# already there, so a second run installs nothing and prints what it found. Pass
# --force to reinstall and upgrade anyway.
#
# Pass component names to install a subset:
#
#   curl -fsSL https://raw.githubusercontent.com/aabuhijleh/abed-hub/main/setup.sh | bash -s -- gh-attach courier
#
# Everything installs globally into your bun and skills directories. Nothing
# needs root. Credentials are not touched; the script prints the commands that
# set those up, since they are interactive.

set -euo pipefail

REPO="aabuhijleh/abed-hub"
SKILLS_STORE="$HOME/.agents/skills"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}/abed-hub"

if [ -t 1 ]; then
  bold=$(printf '\033[1m'); dim=$(printf '\033[2m'); red=$(printf '\033[31m')
  yellow=$(printf '\033[33m'); green=$(printf '\033[32m'); reset=$(printf '\033[0m')
else
  bold=; dim=; red=; yellow=; green=; reset=
fi

step() { printf '\n%s==>%s %s%s\n' "$green" "$reset" "$bold$1" "$reset"; }
did() { printf '  %s+%s %s\n' "$green" "$reset" "$1"; }
skip() { printf '  %s· %s (already there)%s\n' "$dim" "$1" "$reset"; skipped=$((skipped + 1)); }
warn() { printf '  %s! %s%s\n' "$yellow" "$1" "$reset"; }
die() { printf '\n%serror:%s %s\n' "$red" "$reset" "$1" >&2; exit 1; }

has() { command -v "$1" >/dev/null 2>&1; }

skipped=0

# --- what to install -------------------------------------------------------

force=0
want_gh_attach=0
want_prs=0
want_courier=0
named=0

for arg in "$@"; do
  case "$arg" in
    -f|--force) force=1 ;;
    all) want_gh_attach=1; want_prs=1; want_courier=1; named=1 ;;
    gh-attach) want_gh_attach=1; named=1 ;;
    writing-great-prs|prs) want_prs=1; want_gh_attach=1; named=1 ;;
    courier) want_courier=1; named=1 ;;
    -h|--help)
      printf 'usage: setup.sh [--force] [all | gh-attach | writing-great-prs | courier]...\n'
      exit 0 ;;
    *) die "unknown argument: $arg (try: --force, all, gh-attach, writing-great-prs, courier)" ;;
  esac
done

if [ "$named" = 0 ]; then
  want_gh_attach=1; want_prs=1; want_courier=1
fi

# --- prerequisites ---------------------------------------------------------

has bun || die "bun is required. Install it from https://bun.sh, then run this again."

# bun's global bin directory may not be on PATH in this shell, so look there too.
bun_bin=$(bun pm bin -g 2>/dev/null || true)

have_bin() {
  has "$1" && return 0
  [ -n "$bun_bin" ] && [ -x "$bun_bin/$1" ]
}

# Install a global package unless one of its binaries is already present.
add_pkg() {
  local pkg=$1 bin=$2
  if [ "$force" = 0 ] && have_bin "$bin"; then skip "$bin"; return; fi
  bun add -g "$pkg" >/dev/null
  did "$bin"
}

# Skills land in ~/.agents/skills/<name> and are linked into each agent's directory.
add_skill() {
  local repo=$1 skill=$2
  if [ "$force" = 0 ] && [ -e "$SKILLS_STORE/$skill" ]; then skip "skill $skill"; return; fi
  bunx skills add "$repo" -s "$skill" -g -y >/dev/null
  did "skill $skill"
}

next_steps=()

# --- gh-attach -------------------------------------------------------------

if [ "$want_gh_attach" = 1 ]; then
  step "gh-attach"
  add_pkg @aabuhijleh/gh-attach gh-attach

  if has gh; then
    if gh extension list 2>/dev/null | grep -q 'gh-image'; then
      if [ "$force" = 1 ]; then
        gh extension upgrade drogers0/gh-image >/dev/null 2>&1 || true
        did "gh extension gh-image (upgraded)"
      else
        skip "gh extension gh-image"
      fi
    else
      gh extension install drogers0/gh-image >/dev/null
      did "gh extension gh-image"
    fi
    gh auth status >/dev/null 2>&1 || next_steps+=("gh auth login    # sign in to the GitHub CLI")
  else
    warn "the GitHub CLI is missing, so gh-image was skipped"
    next_steps+=("# install the GitHub CLI (https://cli.github.com), then:")
    next_steps+=("gh auth login")
    next_steps+=("gh extension install drogers0/gh-image")
  fi

  add_skill "$REPO" gh-attach
  [ -f "$CONFIG_HOME/gh-attach/token" ] \
    || next_steps+=("gh-attach token  # grab a GitHub session cookie")
fi

# --- writing-great-prs -----------------------------------------------------

if [ "$want_prs" = 1 ]; then
  step "writing-great-prs"
  add_pkg @playwright/cli playwright-cli

  browsers="${PLAYWRIGHT_BROWSERS_PATH:-}"
  if [ -z "$browsers" ]; then
    case "$(uname -s)" in
      Darwin) browsers="$HOME/Library/Caches/ms-playwright" ;;
      *) browsers="${XDG_CACHE_HOME:-$HOME/.cache}/ms-playwright" ;;
    esac
  fi
  have_chromium=1
  for dir in "$browsers"/chromium-*; do
    if [ -d "$dir" ]; then have_chromium=0; break; fi
  done

  if [ "$have_chromium" = 0 ] && [ "$force" = 0 ]; then
    skip "chromium"
  elif playwright-cli install-browser chromium >/dev/null 2>&1; then
    did "chromium"
  else
    warn "chromium install failed; run 'playwright-cli install-browser chromium' yourself"
  fi

  add_skill "$REPO" writing-great-prs
  add_skill microsoft/playwright-cli playwright-cli
  add_skill cursor/plugins unslop
fi

# --- courier ---------------------------------------------------------------

if [ "$want_courier" = 1 ]; then
  step "courier"
  add_pkg @aabuhijleh/courier jira

  add_skill "$REPO" courier

  courier_config="$CONFIG_HOME/courier/config.json"
  configured() { [ -f "$courier_config" ] && grep -q "\"$1\"" "$courier_config"; }
  configured jira || next_steps+=("jira setup       # an Atlassian API token")
  configured slack || next_steps+=("slack setup      # a Slack app and its bot token")
fi

# --- what's left -----------------------------------------------------------

printf '\n%sDone.%s' "$green$bold" "$reset"
if [ "$skipped" -gt 0 ] && [ "$force" = 0 ]; then
  printf ' %d step(s) were already done and left alone; --force redoes them.' "$skipped"
fi
printf '\n'

if [ "${#next_steps[@]}" -gt 0 ]; then
  printf '\nRun these yourself, they ask questions:\n\n'
  for line in "${next_steps[@]}"; do printf '  %s\n' "$line"; done
  printf '\n'
fi
