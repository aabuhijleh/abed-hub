#!/usr/bin/env bash
# Approves every open PR in a stack in one GitHub call, skipping your own, drafts, and ones you approved.
# Usage: approve.sh [pr-number | pr-url | branch] [--dry-run]   (defaults to the current branch)
# Exit: 0 done; 1 GitHub rejected the approvals; 2 not in a stack.
set -euo pipefail

dry_run=false
args=()
for arg in "$@"; do
  if [[ $arg == --dry-run ]]; then dry_run=true; else args+=("$arg"); fi
done
target=${args[0]:-$(git branch --show-current)}

case $target in
  *[!0-9]*)
    if [[ $target =~ /pull/([0-9]+) ]]; then
      pr=${BASH_REMATCH[1]}
    elif ! pr=$(gh pr view "$target" --json number --jq .number 2>/dev/null); then
      echo "No pull request for '$target'." >&2
      exit 2
    fi
    ;;
  *) pr=$target ;;
esac

stacks=$(gh api "repos/{owner}/{repo}/stacks?pull_request=$pr")
if [[ $(jq length <<<"$stacks") == 0 ]]; then
  echo "PR #$pr is not in a stack on GitHub." >&2
  exit 2
fi
stack=$(jq '.[0]' <<<"$stacks")

query=$(jq -r '
  "query($owner: String!, $name: String!) { viewer { login } repository(owner: $owner, name: $name) { "
  + ([.pull_requests[] | select(.merged_at == null and .state == "open")
      | "p\(.number): pullRequest(number: \(.number)) { id number isDraft author { login } viewerLatestReview { state } }"]
     | join(" "))
  + " } }"' <<<"$stack")
data=$(gh api graphql -F owner='{owner}' -F name='{repo}' -f query="$query")

plan=$(jq '
  .data.viewer.login as $me
  | [.data.repository[] | . + {
      action: (
        if .author.login == $me then "own"
        elif .isDraft then "draft"
        elif .viewerLatestReview.state == "APPROVED" then "done"
        else "approve" end
      )
    }]
  | sort_by(.number)' <<<"$data")
me=$(jq -r .data.viewer.login <<<"$data")

mutation=$(jq -r '
  [.[] | select(.action == "approve")]
  | if length == 0 then empty else
      "mutation { "
      + (map("a\(.number): addPullRequestReview(input: {pullRequestId: \"\(.id)\", event: APPROVE}) { pullRequestReview { state } }") | join(" "))
      + " }"
    end' <<<"$plan")

if [[ -n $mutation && $dry_run == false ]]; then
  gh api graphql -f query="$mutation" >/dev/null
fi

verb=$([[ $dry_run == true ]] && echo "would approve" || echo "approved")
echo "📚 Stack #$(jq .number <<<"$stack") as @$me$([[ $dry_run == true ]] && echo ", dry run")"
jq -r --arg verb "$verb" '.[] |
  if .action == "approve" then "✅ #\(.number) \($verb)"
  elif .action == "done" then "☑️ #\(.number) already approved by you"
  elif .action == "draft" then "📝 #\(.number) draft, skipped"
  else "⏭️ #\(.number) yours, and GitHub does not let an author approve" end' <<<"$plan"
