import * as p from "@clack/prompts";
import { bold, dim, green, red, yellow } from "./color";
import type { Finding, Status } from "./finding";
import type { Inspection } from "./inspect";
import { pad, plural } from "./utils";

const MARK: Record<Status, string> = {
  ok: green("✔"),
  stale: yellow("▲"),
  missing: red("✖"),
  broken: red("!"),
  warning: yellow("!"),
};

function block(findings: Finding[]): string {
  const width = Math.max(...findings.map((f) => f.name.length)) + 2;
  return findings
    .map((f) => `${MARK[f.status]} ${pad(f.name, width)}${dim(f.detail)}`)
    .join("\n");
}

export function printGroup(title: string, findings: Finding[]): void {
  if (findings.length === 0) return;
  p.log.step(bold(title));
  p.log.message(block(findings));
}

export function printInspection(inspection: Inspection): void {
  printGroup("Packages", inspection.packages);
  printGroup("Skills", inspection.skills);
  printGroup("Tools", inspection.tools);
}

export function count(findings: Finding[], status: Status): number {
  return findings.filter((f) => f.status === status).length;
}

/** "2 behind, 1 missing", or an empty string when everything is fine. */
export function summarize(findings: Finding[]): string {
  const parts = [
    [count(findings, "stale"), "behind"],
    [count(findings, "missing"), "missing"],
    [count(findings, "broken"), "needing repair"],
  ] as const;

  return parts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(", ");
}

/** Doctor's last line, and whether it exits 1. Warnings alone never fail it. */
export function doctorOutcome(findings: Finding[]): {
  failed: boolean;
  message: string;
} {
  const trouble = summarize(findings);
  if (!trouble) {
    const warnings = count(findings, "warning");
    return {
      failed: false,
      message:
        warnings > 0
          ? `Everything is here and up to date. ${plural(warnings, "warning")} for tools you may not use.`
          : "Everything is here and up to date.",
    };
  }
  const next =
    count(findings, "missing") > 0 ? "abed-hub setup" : "abed-hub update";
  return { failed: true, message: `${trouble}. ${next} fixes what it can.` };
}

/**
 * The commands the CLI will not run for you. Every one of them either asks a
 * question or needs a package manager this tool does not own.
 */
export function printManual(steps: string[]): void {
  if (steps.length === 0) return;
  p.note(steps.join("\n"), "Run these yourself, they ask questions");
}
