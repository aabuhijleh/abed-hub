/** `broken` is installed but not working; `warning` never fails doctor or counts as work. */
export type Status = "ok" | "stale" | "missing" | "broken" | "warning";

/** The three kinds of dependency, which is also how the report is grouped. */
export type Kind = "package" | "skill" | "tool";

export type Fix =
  /** A command this CLI can run. */
  | { run: "command"; argv: string[]; label: string; loud?: boolean }
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
  if (finding.status === "ok" || finding.status === "warning") return false;
  if (finding.status === "stale") return upgrade;
  return true;
}
