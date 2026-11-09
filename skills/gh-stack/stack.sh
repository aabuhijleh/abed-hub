#!/usr/bin/env bash
# Prints the GitHub stack a target names, plus `target`, the PR to mark or null, and `repo`, its owner/repo.
# Usage: stack.sh [pr-number | pr-url | stack-number | stack-url | branch]   (defaults to the current branch)
# A `#` before a number is optional. A URL's owner/repo wins over the checkout's.
# Exit: 0 printed; 2 no such PR or stack, or the PR is in no stack; 4 GitHub API failure; 9 stacks off.
set -euo pipefail

target=${1:-$(git branch --show-current)}
target=${target#\#}
if [[ $target =~ github\.com/([^/]+/[^/]+)/(pull|stack)/ ]]; then
  export GH_REPO=${BASH_REMATCH[1]}
fi

stack_by_number() {
  gh api "repos/{owner}/{repo}/stacks/$1" 2>/dev/null
}

pr=""
if [[ $target =~ /stack/([0-9]+) ]]; then
  number=${BASH_REMATCH[1]}
  if ! stack=$(stack_by_number "$number"); then
    echo "No stack #$number, or stacked PRs are off for this repository." >&2
    exit 2
  fi
elif [[ $target =~ ^[0-9]+$ ]] && stack=$(stack_by_number "$target"); then
  # PRs and stacks share one number sequence, so a number that is a stack is not a PR.
  :
else
  if [[ $target =~ /pull/([0-9]+) ]]; then
    pr=${BASH_REMATCH[1]}
  elif [[ $target =~ ^[0-9]+$ ]]; then
    pr=$target
  elif ! pr=$(gh pr view "$target" --json number --jq .number 2>/dev/null); then
    echo "No pull request or stack for '$target'." >&2
    exit 2
  fi

  if ! stacks=$(gh api "repos/{owner}/{repo}/stacks?pull_request=$pr" 2>&1); then
    if grep -q "HTTP 404" <<<"$stacks"; then
      echo "Stacked PRs are off for this repository." >&2
      exit 9
    fi
    echo "$stacks" >&2
    exit 4
  fi

  if [[ $(jq length <<<"$stacks") == 0 ]]; then
    if ! base=$(gh pr view "$pr" --json baseRefName --jq .baseRefName 2>/dev/null); then
      echo "No pull request or stack #$pr." >&2
      exit 2
    fi
    trunk=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)
    echo "PR #$pr is not in a stack on GitHub." >&2
    if [[ $base != "$trunk" ]]; then
      echo "Its base is '$base', not '$trunk': a hand-built chain." >&2
      echo "Link it with: gh stack link <bottom-pr> ... <top-pr>" >&2
    fi
    exit 2
  fi
  stack=$(jq '.[0]' <<<"$stacks")
fi

jq --argjson pr "${pr:-null}" '. + {target: $pr, repo: (.url | capture("/repos/(?<r>[^/]+/[^/]+)/").r)}' <<<"$stack"
