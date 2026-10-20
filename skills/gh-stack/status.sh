#!/usr/bin/env bash
# Reports a stack from GitHub, bottom to top: merge state, commits behind base, checks.
# Usage: status.sh [pr-number | pr-url | branch]   (defaults to the current branch)
# Exit: 0 report printed, whatever the checks say; 2 not in a stack; 9 stacks off.
set -euo pipefail

target=${1:-$(git branch --show-current)}
if ! pr=$(gh pr view "$target" --json number --jq .number 2>/dev/null); then
  echo "No pull request for '$target'." >&2
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
  base=$(gh pr view "$pr" --json baseRefName --jq .baseRefName)
  trunk=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)
  echo "PR #$pr is not in a stack on GitHub."
  if [[ $base != "$trunk" ]]; then
    echo "Its base is '$base', not '$trunk': a hand-built chain."
    echo "Link it with: gh stack link <bottom-pr> ... <top-pr>"
  fi
  exit 2
fi

stack=$(jq --argjson pr "$pr" '.[0] + {target: $pr}' <<<"$stacks")

query=$(jq -r --arg trunk "$(jq -r .base.ref <<<"$stack")" '
  def checks($n): "commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) { nodes { __typename ... on CheckRun { name status conclusion startedAt checkSuite { workflowRun { workflow { name } } } isRequired(pullRequestNumber: \($n)) } ... on StatusContext { context state isRequired(pullRequestNumber: \($n)) } } } } } } }";
  [.pull_requests[] | select(.merged_at == null and .state == "open")]
  | if length == 0 then empty else
      "query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { "
      + (map("p\(.number): pullRequest(number: \(.number)) { number headRefName baseRefName isDraft mergeable mergeStateStatus baseRef { compare(headRef: \"\(.head.ref)\") { behindBy } } \(checks(.number)) }") | join(" "))
      + " " + (map("t\(.number): ref(qualifiedName: \"refs/heads/\($trunk)\") { compare(headRef: \"\(.head.ref)\") { behindBy } }") | join(" "))
      + " } }"
    end' <<<"$stack")

prs='{}'
if [[ -n $query ]]; then
  prs=$(gh api graphql -F owner='{owner}' -F name='{repo}' -f query="$query" --jq .data.repository)
fi

common_dir=$(git rev-parse --git-common-dir)
tracked=false
if [[ -f $common_dir/gh-stack ]] &&
  jq -e --argjson stack "$stack" '
    [$stack.pull_requests[].head.ref] as $heads
    | any(.stacks[]; .number == $stack.number or any(.branches[]; .branch as $b | $heads | index($b)))
  ' "$common_dir/gh-stack" >/dev/null; then
  tracked=true
fi

jq -r -n --argjson stack "$stack" --argjson prs "$prs" --argjson tracked "$tracked" -f "$(dirname "$0")/status.jq"
