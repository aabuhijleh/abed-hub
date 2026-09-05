/** One entry from `npm stage list --json`. */
export interface StagedVersion {
  id: string;
  packageName: string;
  version: string;
  /** The dist-tag it takes on approval, usually `latest`. */
  tag: string;
  createdAt: string;
  actor: string;
  actorType: string;
  access: string;
  shasum: string;
  status: string;
}

/**
 * Parse `npm stage list --json`, keeping only entries still awaiting a decision.
 *
 * Every field is checked because this drives a publish. A shape npm changes out
 * from under us should stop the script, not quietly approve the wrong thing.
 */
export function parseStaged(json: string): StagedVersion[] {
  const raw: unknown = JSON.parse(json);
  if (!Array.isArray(raw))
    throw new Error("npm stage list did not return a list");

  return raw.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`staged entry ${index} is not an object`);
    }
    const record = entry as Record<string, unknown>;
    const text = (key: string): string => {
      const value = record[key];
      if (typeof value !== "string") {
        throw new Error(`staged entry ${index} has no ${key}`);
      }
      return value;
    };
    return {
      id: text("id"),
      packageName: text("packageName"),
      version: text("version"),
      tag: text("tag"),
      createdAt: text("createdAt"),
      actor: text("actor"),
      actorType: text("actorType"),
      access: text("access"),
      shasum: text("shasum"),
      status: text("status"),
    };
  });
}

/**
 * True when CI staged this over OIDC. Anything else means a person uploaded a
 * tarball from a machine, which is not how this repo releases, and is worth a
 * second look before it goes public.
 */
export function fromAutomation(entry: StagedVersion): boolean {
  return entry.actorType === "trusted automation";
}

/** Rough age, for spotting an entry that has been sitting in the queue. */
export function age(createdAt: string, now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - Date.parse(createdAt)) / 1000);
  if (!Number.isFinite(seconds)) return "unknown";

  const scales: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [Number.POSITIVE_INFINITY, "day"],
  ];

  let value = seconds;
  for (const [step, unit] of scales) {
    if (value < step) {
      const whole = Math.floor(value);
      return whole <= 0 && unit === "second"
        ? "just now"
        : `${whole} ${unit}${whole === 1 ? "" : "s"} ago`;
    }
    value /= step;
  }
  return "unknown";
}
