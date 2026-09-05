#!/usr/bin/env bash
# Installs the abed-hub tools and skills.
#
#   curl -fsSL "https://raw.githubusercontent.com/aabuhijleh/abed-hub/main/setup.sh?$(date +%s)" | bash
#
# Safe to re-run: every step checks for its own result first and skips if it is
# already there, so a second run installs nothing and prints what it found. Pass
# --force to reinstall and upgrade anyway.
#
# Pass component names to install a subset:
#
#   curl -fsSL "https://raw.githubusercontent.com/aabuhijleh/abed-hub/main/setup.sh?$(date +%s)" | bash -s -- gh-attach gh-stack
#
# Everything installs globally into your bun and skills directories. Nothing
# needs root. Credentials are not touched; the script prints the commands that
# set those up, since they are interactive.
#
# Two rules keep this working when piped to bash, where the script itself
# arrives on stdin: the work lives in main(), so bash reads the whole file
# before running any of it, and every child command gets </dev/null, so none of
# them can read the rest of the script and cut the run short.

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

# Queue a command for the user to run at the end. More than one component can
# ask for the same one, "gh auth login" above all, so keep only the first.
note_step() {
  local queued
  for queued in ${next_steps+"${next_steps[@]}"}; do
    [ "$queued" = "$1" ] && return 0
  done
  next_steps+=("$1")
}

# bun's global bin directory may not be on PATH in this shell, so look there too.
have_bin() {
  has "$1" && return 0
  [ -n "$bun_bin" ] && [ -x "$bun_bin/$1" ]
}

# Run a command with its chatter hidden. A run that works says nothing, since the
# caller already prints a line for it. A run that fails prints everything it said
# and stops the script, so no real error is ever swallowed.
#
# This is what hides the "YAML parse error" warning from cursor/plugins: `skills
# add` reads every SKILL.md in that repo, one of them has an unquoted colon in its
# frontmatter, and it complains about a skill we are not installing. Nothing is
# wrong on this end and the exit status is 0.
quietly() {
  local log status=0
  log=$(mktemp)
  "$@" >"$log" 2>&1 </dev/null || status=$?
  if [ "$status" -ne 0 ]; then
    printf '\n' >&2
    cat "$log" >&2
    rm -f "$log"
    die "$1 failed (exit $status)"
  fi
  rm -f "$log"
}

# Install a global package unless one of its binaries is already present.
add_pkg() {
  local pkg=$1 bin=$2
  if [ "$force" = 0 ] && have_bin "$bin"; then skip "$bin"; return; fi
  quietly bun add -g "$pkg"
  did "$bin"
}

# Skills land in ~/.agents/skills/<name> and are linked into each agent's directory.
add_skill() {
  local repo=$1 skill=$2
  if [ "$force" = 0 ] && [ -e "$SKILLS_STORE/$skill" ]; then skip "skill $skill"; return; fi
  quietly bunx skills add "$repo" -s "$skill" -g -y
  did "skill $skill"
}

# Where playwright keeps its browsers.
browser_cache() {
  if [ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then printf '%s\n' "$PLAYWRIGHT_BROWSERS_PATH"; return; fi
  case "$(uname -s)" in
    Darwin) printf '%s\n' "$HOME/Library/Caches/ms-playwright" ;;
    *) printf '%s\n' "${XDG_CACHE_HOME:-$HOME/.cache}/ms-playwright" ;;
  esac
}

# gh's --attach flag, which the gh-attach skill drives, landed in 2.99.0.
GH_MIN=2.99.0

# True when gh is at least $GH_MIN. sort -V orders version strings correctly, so
# the lower of the two sorting first means the installed one clears the bar.
gh_new_enough() {
  local found
  found=$(gh --version </dev/null 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  [ -n "$found" ] || return 1
  [ "$(printf '%s\n%s\n' "$GH_MIN" "$found" | sort -V | head -1)" = "$GH_MIN" ]
}

setup_gh_attach() {
  step "gh-attach"
  add_pkg @aabuhijleh/gh-attach gh-attach

  if has gh; then
    if gh_new_enough; then
      gh auth status >/dev/null 2>&1 </dev/null \
        || note_step "gh auth login    # sign in to the GitHub CLI"
    else
      warn "the GitHub CLI is older than $GH_MIN, which is where --attach landed"
      note_step "# upgrade the GitHub CLI to $GH_MIN or later, then:"
      note_step "gh auth login"
    fi
  else
    warn "the GitHub CLI is missing, so attaching will not work"
    note_step "# install the GitHub CLI $GH_MIN or later (https://cli.github.com), then:"
    note_step "gh auth login"
  fi

  add_skill "$REPO" gh-attach
}

setup_gh_stack() {
  step "gh-stack"

  if has gh; then
    if gh extension list </dev/null 2>/dev/null | grep -q 'github/gh-stack'; then
      if [ "$force" = 1 ]; then
        gh extension upgrade github/gh-stack >/dev/null 2>&1 </dev/null || true
        did "gh extension gh-stack (upgraded)"
      else
        skip "gh extension gh-stack"
      fi
    else
      quietly gh extension install github/gh-stack
      did "gh extension gh-stack"
    fi
    gh auth status >/dev/null 2>&1 </dev/null \
      || note_step "gh auth login    # sign in to the GitHub CLI"
  else
    warn "the GitHub CLI is missing, so the gh stack extension was skipped"
    note_step "# install the GitHub CLI (https://cli.github.com), then:"
    note_step "gh auth login"
    note_step "gh extension install github/gh-stack"
  fi

  add_skill "$REPO" gh-stack
}

setup_prs() {
  step "writing-great-prs"
  add_pkg @playwright/cli playwright-cli

  local cache dir have_chromium=1
  cache=$(browser_cache)
  for dir in "$cache"/chromium-*; do
    if [ -d "$dir" ]; then have_chromium=0; break; fi
  done

  if [ "$have_chromium" = 0 ] && [ "$force" = 0 ]; then
    skip "chromium"
  else
    # Over 350 MB, so let the download print its own progress rather than
    # looking hung for a few minutes.
    printf '  %sdownloading chromium, this takes a few minutes%s\n' "$dim" "$reset"
    if playwright-cli install-browser chromium </dev/null; then
      did "chromium"
    else
      warn "chromium install failed; run 'playwright-cli install-browser chromium' yourself"
    fi
  fi

  add_skill "$REPO" writing-great-prs
  add_skill microsoft/playwright-cli playwright-cli
  add_skill cursor/plugins unslop
}

setup_courier() {
  step "courier"
  add_pkg @aabuhijleh/courier jira
  add_skill "$REPO" courier

  local config="$CONFIG_HOME/courier/config.json"
  configured() { [ -f "$config" ] && grep -q "\"$1\"" "$config"; }
  configured jira || note_step "jira setup       # an Atlassian API token"
  configured slack || note_step "slack setup      # a Slack app and its bot token"
}

main() {
  local arg
  force=0
  skipped=0
  next_steps=()
  local want_gh_attach=0 want_gh_stack=0 want_prs=0 want_courier=0 named=0

  for arg in "$@"; do
    case "$arg" in
      -f|--force) force=1 ;;
      all) want_gh_attach=1; want_gh_stack=1; want_prs=1; want_courier=1; named=1 ;;
      gh-attach) want_gh_attach=1; named=1 ;;
      gh-stack) want_gh_stack=1; named=1 ;;
      writing-great-prs|prs) want_prs=1; want_gh_attach=1; named=1 ;;
      courier) want_courier=1; named=1 ;;
      -h|--help)
        printf 'usage: setup.sh [--force] [all | gh-attach | gh-stack | writing-great-prs | courier]...\n'
        return 0 ;;
      *) die "unknown argument: $arg (try: --force, all, gh-attach, gh-stack, writing-great-prs, courier)" ;;
    esac
  done

  if [ "$named" = 0 ]; then
    want_gh_attach=1; want_gh_stack=1; want_prs=1; want_courier=1
  fi

  has bun || die "bun is required. Install it from https://bun.sh, then run this again."
  bun_bin=$(bun pm bin -g 2>/dev/null </dev/null || true)

  if [ "$want_gh_attach" = 1 ]; then setup_gh_attach; fi
  if [ "$want_gh_stack" = 1 ]; then setup_gh_stack; fi
  if [ "$want_prs" = 1 ]; then setup_prs; fi
  if [ "$want_courier" = 1 ]; then setup_courier; fi

  printf '\n%sDone.%s' "$green$bold" "$reset"
  if [ "$skipped" -gt 0 ] && [ "$force" = 0 ]; then
    printf ' %d step(s) were already done and left alone; --force redoes them.' "$skipped"
  fi
  printf '\n'

  if [ "${#next_steps[@]}" -gt 0 ]; then
    printf '\nRun these yourself, they ask questions:\n\n'
    for arg in "${next_steps[@]}"; do printf '  %s\n' "$arg"; done
    printf '\n'
  fi
}

main "$@"
