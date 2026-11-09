#!/usr/bin/env bash
# Reports a stack from GitHub, bottom to top: merge state, commits behind base, checks.
# Usage: status.sh [pr-number | pr-url | stack-number | stack-url | branch]   (defaults to the current branch)
# Exit: 0 report printed, whatever the checks say; else stack.sh's exit.
set -euo pipefail

stack=$(bash "$(dirname "$0")/stack.sh" "$@")
export GH_REPO=$(jq -r .repo <<<"$stack")

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

# Test-merge only the stale or conflicting layers, so a current stack costs no fetch.
trunk=$(jq -r .base.ref <<<"$stack")
flagged=$(jq -r '.[] | select(.number != null)
  | select(.mergeable == "CONFLICTING" or .mergeStateStatus == "DIRTY" or (.baseRef.compare.behindBy // 0) > 0)
  | "\(.number) \(.baseRefName) \(.headRefName)"' <<<"$prs")
behind=$(jq -r --argjson prs "$prs" 'to_entries[] | select(.key | startswith("t")) | select(.value.compare.behindBy > 0)
  | .key[1:] as $n | $prs["p\($n)"] | "\(.number) \(.baseRefName) \(.headRefName)"' <<<"$prs")
flagged=$(printf '%s\n%s\n' "$flagged" "$behind" | sed '/^$/d' | sort -u)
files='{}'
if [[ -n $flagged ]]; then
  remote=$(git config remote.pushDefault || echo origin)
  # shellcheck disable=SC2046
  git fetch -q "$remote" "$trunk" $(awk '{print $2; print $3}' <<<"$flagged" | sort -u) 2>/dev/null || true
  while read -r number base head; do
    with_base=$(bash "$(dirname "$0")/conflicts.sh" "$remote/$base" "$remote/$head" | jq -R . | jq -s .)
    with_trunk=$(bash "$(dirname "$0")/conflicts.sh" "$remote/$trunk" "$remote/$head" | jq -R . | jq -s .)
    files=$(jq --arg n "$number" --argjson base "$with_base" --argjson trunk "$with_trunk" \
      '. + {($n): {base: $base, trunk: $trunk}}' <<<"$files")
  done <<<"$flagged"
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

jq -r -n --argjson stack "$stack" --argjson prs "$prs" --argjson files "$files" --argjson tracked "$tracked" -f "$(dirname "$0")/status.jq"
