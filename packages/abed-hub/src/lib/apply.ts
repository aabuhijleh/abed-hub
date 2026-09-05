import * as p from "@clack/prompts";
import { spinner } from "./cli";
import { dim } from "./color";
import { capture, captureLoud } from "./exec";
import { type Finding, needsWork } from "./finding";
import { repairPatches } from "./inspect";
import type { Component } from "./registry";

export interface ApplyResult {
  done: string[];
  failed: { label: string; message: string }[];
  /** Labels the user has to run, with a reason where one helps. */
  manual: string[];
  /** Findings that were already fine, so the outro can say so. */
  untouched: number;
}

/**
 * Run the fixes for everything that needs work. `upgrade` decides whether
 * being behind counts: `setup` leaves a working install alone, `update` is the
 * command that moves it forward.
 */
export async function applyFixes(
  findings: Finding[],
  components: Component[],
  { upgrade }: { upgrade: boolean },
): Promise<ApplyResult> {
  const result: ApplyResult = {
    done: [],
    failed: [],
    manual: [],
    untouched: 0,
  };
  const seen = new Set<string>();

  for (const finding of findings) {
    if (!needsWork(finding, upgrade)) {
      result.untouched++;
      continue;
    }
    const { fix } = finding;
    if (!fix) continue;

    // Several components ask for `gh auth login`. Keep the first.
    if (seen.has(fix.label)) continue;
    seen.add(fix.label);

    if (fix.run === "manual") {
      result.manual.push(
        fix.hint ? `${fix.label}${dim(`    # ${fix.hint}`)}` : fix.label,
      );
      continue;
    }

    if (fix.run === "local") {
      await fix.apply();
      p.log.success(fix.label);
      result.done.push(fix.label);
      continue;
    }

    if (fix.loud) {
      // The child prints its own progress, so a spinner would fight it.
      p.log.step(`${fix.label}${dim("    # this takes a few minutes")}`);
      const { ok, code } = await captureLoud(fix.argv);
      if (ok) result.done.push(fix.label);
      else result.failed.push({ label: fix.label, message: `exit ${code}` });
      continue;
    }

    const s = spinner();
    s.start(fix.label);
    const { ok, code, stdout, stderr } = await capture(fix.argv);
    if (ok) {
      s.stop(fix.label);
      result.done.push(fix.label);
    } else {
      s.stop(fix.label);
      // Only a failing command gets to print, so a `skills add` that works but
      // grumbles about someone else's frontmatter stays quiet.
      const output = `${stdout}${stderr}`.trim();
      if (output) p.log.message(dim(output));
      result.failed.push({ label: fix.label, message: `exit ${code}` });
    }
  }

  for (const name of await repairPatches(components)) {
    const label = `let agents invoke ${name}`;
    if (!result.done.includes(label)) {
      p.log.success(label);
      result.done.push(label);
    }
  }

  return result;
}
