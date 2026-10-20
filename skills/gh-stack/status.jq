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

def named($required; $state):
  [checks[] | select((.isRequired == $required) and bucket == $state) | check_name] | unique;

def behind_trunk: $prs["t\(.number)"].compare.behindBy // 0;
def behind_base: .baseRef.compare.behindBy // 0;
def numbers: map("#\(.number)") | join(", ");
def base_conflicts: $files["\(.number)"].base // [];
def trunk_conflicts: $files["\(.number)"].trunk // [];
def conflicting: .mergeable == "CONFLICTING" or .mergeStateStatus == "DIRTY" or (base_conflicts | length > 0);

# Every emoji here is one code point drawn two columns wide.
def width: length + ([scan("[✅❌⏳🟡🔒🟢💥🔀🚫👉📝]")] | length);
def pad($n): . + ((($n - width) | if . > 0 then . else 0 end) as $k | if $k > 0 then " " * $k else "" end);

def checks_cell:
  if (named(true; "fail") | length) > 0 then "❌ \(named(true; "fail") | length) required failing"
  elif (named(true; "pending") + named(false; "pending") | length) > 0 then "⏳ \(named(true; "pending") + named(false; "pending") | length) running"
  elif (named(false; "fail") | length) > 0 then "🟡 \(named(false; "fail") | length) optional failing"
  else "✅ \(checks | map(select(bucket == "pass")) | length) passed" end;

def merge_cell:
  if conflicting then "💥 conflicts"
  elif .isDraft then "📝 draft"
  elif .mergeStateStatus == "BEHIND" then "❌ behind"
  elif .mergeStateStatus == "UNKNOWN" then "⏳ computing"
  elif .mergeStateStatus == "BLOCKED" then
    if (named(true; "fail") + named(true; "pending") | length) > 0 then "🔒 checks" else "🔒 review or rule" end
  else "🟢 ready" end;

def behind_cell($n; $clash):
  if $n > 0 then "\(if $clash then "💥" else "❌" end) \($n) behind"
  elif $clash then "💥"
  else "✅" end;

def cells($i; $total):
  $prs["p\(.number)"] as $p
  | [
      (if .number == $stack.target then "👉" else "" end),
      "\($i + 1)/\($total)",
      "#\(.number)",
      .head.ref
    ]
    + if .merged_at != null then ["🔀 merged", "", "", ""]
      elif .state != "open" then ["🚫 closed", "", "", ""]
      else [
        ($p | behind_cell(behind_trunk; trunk_conflicts | length > 0)),
        ($p | behind_cell(behind_base; conflicting)),
        ($p | checks_cell),
        ($p | merge_cell)
      ] end;

[$prs | to_entries[] | select(.key | startswith("p")) | .value] as $open
| [$open[] | select(behind_trunk > 0)] as $behind_trunk
| [$open[] | select(behind_base > 0 or .mergeStateStatus == "BEHIND")] as $behind_base
| [$open[] | select(conflicting)] as $conflicts
| [$open[] | select(trunk_conflicts | length > 0)] as $predicted
| [$open[] | select(named(true; "fail") | length > 0)] as $red
| [$open[] | select(named(true; "pending") + named(false; "pending") | length > 0)] as $running
| [$open[] | select(named(false; "fail") | length > 0)] as $amber
| [$open[] | select(.mergeStateStatus == "BLOCKED" and (named(true; "fail") + named(true; "pending") | length == 0))] as $review
| ($stack.pull_requests | length) as $total
| ([$stack.pull_requests[] | .number] | index($stack.target)) as $position
| $stack.base.ref as $trunk
| ([["", "Pos", "PR", "Branch", ($trunk[:1] | ascii_upcase) + $trunk[1:], "Base", "Checks", "Merge"]]
   + [$stack.pull_requests | to_entries[] | .key as $i | .value | cells($i; $total)]) as $rows
| [range(0; 8) as $c | [$rows[][$c] | width] | max] as $widths
| "📚 Stack #\($stack.number): \($total) PRs onto \($trunk), bottom to top",
  "👉 #\($stack.target) is \($position + 1) of \($total)",
  "",
  ($rows[] | [to_entries[] | .key as $k | .value | pad($widths[$k])] | join("  ") | sub(" +$"; "")),
  "",
  if ($open | length) == 0 then "🔀 Every PR in the stack is merged or closed. Nothing to update."
  else
    (if ($behind_trunk | length) == 0 then "✅ Up to date with \($trunk)"
     else "❌ Behind \($trunk): " + ($behind_trunk | map("#\(.number) by \(behind_trunk)") | join(", ")) end),
    (if ($behind_base | length) == 0 then "✅ Up to date with each base"
     else "❌ Behind its base: " + ($behind_base | map("#\(.number) by \(behind_base)") | join(", ")) end),
    (if ($conflicts + $predicted | length) == 0 then "✅ No conflicts"
     else
       "💥 Conflicts:",
       ($conflicts[] | "     #\(.number) with its base \(.baseRefName): " + (base_conflicts | if length > 0 then join(", ") else "files unknown, run gh stack sync to see them" end)),
       ($predicted[] | "     #\(.number) with \($trunk) once synced: " + (trunk_conflicts | join(", ")))
     end),
    (if ($red + $running + $amber | length) == 0 then "✅ Every check passing on every open PR"
     else
       (if ($red | length) > 0 then "❌ Required checks failing (blocks merge):", ($red[] | "     #\(.number): \(named(true; "fail") | join(", "))") else "✅ Every required check passing" end),
       (if ($running | length) > 0 then "⏳ Checks running: \($running | numbers)" else empty end),
       (if ($amber | length) > 0 then "🟡 Optional checks failing (merge not blocked):", ($amber[] | "     #\(.number): \(named(false; "fail") | join(", "))") else empty end)
     end),
    (if ($review | length) > 0 then "🔒 Waiting on a review or repo rule: " + (if ($review | length) == ($open | length) then "all \($open | length) open PRs" else $review | numbers end) else empty end),
    "",
    (if ($conflicts + $predicted | length) > 0 then
       "💡 Suggested update: "
       + (if $tracked then "" else "gh stack checkout \($stack.number), then " end)
       + "gh stack sync. It stops on the conflict; then gh stack rebase, fix the files listed above, git add them, gh stack rebase --continue until it exits 0, and gh stack push. Rerun this report after."
     elif ($behind_trunk + $behind_base | length) > 0 then
       "💡 Suggested update: "
       + (if $tracked then "" else "gh stack checkout \($stack.number), then " end)
       + "gh stack sync, which rebases each layer onto the one below and pushes. Rerun this report after."
     elif ($red | length) > 0 then
       "💡 Suggested: gh pr checks <pr> --required for the run link; gh run rerun <run-id> --failed for a flake."
     elif ($running | length) > 0 then
       "💡 Suggested: gh pr checks <pr> --watch to wait for the running checks."
     else "✨ Nothing to update." end)
  end
