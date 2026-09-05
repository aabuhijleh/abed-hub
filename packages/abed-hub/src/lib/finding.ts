/**
 * `stale` and `missing` are the two staleness answers. `broken` is for
 * something that is installed and the right version but still will not work:
 * a signed-out `gh`, a skill whose local patch has been reverted.
 */
export type Status = "ok" | "stale" | "missing" | "broken";

/** The three kinds of dependency, which is also how the report is grouped. */
export type Kind = "package" | "skill" | "tool";

export type Fix =
  /** A command this CLI can run. */
  | { run: "command"; argv: string[]; label: string; loud?: boolean }
  /** An edit this CLI makes itself, with no child process. */
  | { run: "local"; apply: () => Promise<void>; label: string }
  /** Something only the user can do: install a package manager, paste a token. */
  | { run: "manual"; label: string; hint?: string };

export interface Finding {
  kind: Kind;
  /** What the report calls it. Also the dedupe key. */
  name: string;
  status: Status;
  /** The right-hand column: a version, a reason, whatever explains the status. */
  detail: string;
  fix?: Fix;
}

export function needsWork(finding: Finding, upgrade: boolean): boolean {
  if (finding.status === "ok") return false;
  if (finding.status === "stale") return upgrade;
  return true;
}
