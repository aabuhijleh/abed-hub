def check_name: .name // .context;

def bucket:
  if .__typename == "CheckRun" then
    if .status != "COMPLETED" then "pending"
    elif (.conclusion | IN("SUCCESS", "NEUTRAL", "SKIPPED")) then "pass"
    elif .conclusion == "CANCELLED" then "cancelled"
    else "fail" end
  else
    if .state == "SUCCESS" then "pass"
    elif (.state | IN("PENDING", "EXPECTED")) then "pending"
    else "fail" end
  end;

# A rerun or a newer push leaves the older runs on the commit; GitHub shows only the latest.
def checks:
  [.commits.nodes[0].commit.statusCheckRollup.contexts.nodes[]?]
  | group_by([.checkSuite.workflowRun.workflow.name, check_name])
  | map(max_by(.startedAt // ""));

def tally($checks):
  if ($checks | length) == 0 then "none"
  else
    ($checks | group_by(bucket) | map("\(length) \(.[0] | bucket)") | join(", "))
    + (
      [$checks[] | select(bucket != "pass") | "\(check_name) \(bucket)"]
      | unique
      | if length > 0 then " (" + join("; ") + ")" else "" end
    )
  end;

def behind_trunk: $prs["t\(.number)"].compare.behindBy;
def behind_base: .baseRef.compare.behindBy;
def numbers: map("#\(.number)") | join(", ");
def has_check($required; $state):
  any(checks[]; (.isRequired == $required) and bucket == $state);

def row($i; $total):
  $prs["p\(.number)"] as $p
  | "\(if .number == $stack.target then "→" else " " end) \($i + 1)/\($total) #\(.number) \(.head.ref)"
    + if .merged_at != null then ": merged"
      elif .state != "open" then ": closed"
      else
        " -> \($p.baseRefName)"
        + (if $p.isDraft then " [draft]" else "" end)
        + "\n      merge: \($p.mergeStateStatus), behind base: \($p | behind_base // "?"), behind \($stack.base.ref): \(behind_trunk // "?")"
        + "\n      required: \(tally([$p | checks[] | select(.isRequired)]))"
        + "\n      other: \(tally([$p | checks[] | select(.isRequired | not)]))"
      end;

def staleness:
  [
    (if (behind_trunk // 0) > 0 then "\(behind_trunk) commits behind \($stack.base.ref)" else empty end),
    (if (behind_base // 0) > 0 then "\(behind_base) commits behind its base \(.baseRefName)" else empty end),
    (if .mergeStateStatus == "DIRTY" then "conflicts with its base \(.baseRefName)" else empty end)
  ];

def failing($required):
  [checks[] | select((.isRequired == $required) and bucket == "fail") | check_name] | unique | join(", ");

[$prs | to_entries[] | select(.key | startswith("p")) | .value] as $open
| [$open[] | select(staleness | length > 0)] as $stale
| [$open[] | select(has_check(true; "fail"))] as $red
| [$open[] | select(has_check(true; "pending"))] as $pending
| [$open[] | select(has_check(false; "fail"))] as $amber
| [$open[] | select(.mergeStateStatus == "BLOCKED" and (has_check(true; "fail") or has_check(true; "pending") | not))] as $blocked
| [$open[] | select(.mergeStateStatus == "UNKNOWN")] as $unknown
| ($stack.pull_requests | length) as $total
| ([$stack.pull_requests[] | .number] | index($stack.target)) as $position
| "Stack #\($stack.number) onto \($stack.base.ref), bottom to top. #\($stack.target) is \($position + 1) of \($total)"
  + (if $tracked then "" else "; not tracked locally" end)
  + ".",
  ($stack.pull_requests | to_entries[] | .key as $i | .value | row($i; $total)),
  "",
  if ($open | length) == 0 then "Every PR in the stack is merged or closed. Nothing to update."
  else
    (if ($stale | length) > 0 then
      "Needs updating:",
      ($stale[] | "  #\(.number): " + (staleness | join("; "))),
      "  Fix: " + (if $tracked then "" else "gh stack checkout \($stack.number), then " end)
        + "gh stack sync (rebases every layer in order, then pushes)."
    else
      "Up to date: every open PR contains \($stack.base.ref) and its base, with no conflicts."
    end),
    (if ($red | length) > 0 then
      "Required checks failing (blocks merge):",
      ($red[] | "  #\(.number): \(failing(true))"),
      "  Inspect: gh pr checks <pr> --required. Rerun a flake: gh run rerun <run-id> --failed."
    else empty end),
    (if ($pending | length) > 0 then "Required checks still running on \($pending | numbers): gh pr checks <pr> --required --watch" else empty end),
    (if ($amber | length) > 0 then
      "Warning, optional checks failing (merge not blocked):",
      ($amber[] | "  #\(.number): \(failing(false))")
    else empty end),
    (if ($blocked | length) > 0 then "Blocked by a review or repo rule, not a check: \($blocked | numbers)" else empty end),
    (if ($unknown | length) > 0 then "GitHub is still computing mergeability on \($unknown | numbers); rerun in a few seconds." else empty end),
    (if ($red + $pending | length) == 0 then "Every required check is green." else empty end)
  end
