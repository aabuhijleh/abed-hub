import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { fail, spinner } from "../lib/cli";
import { bold, dim } from "../lib/color";
import { allFindings, inspect } from "../lib/inspect";
import { COMPONENTS } from "../lib/registry";
import { count, printInspection, printManual, summarize } from "../lib/report";
import { selected } from "../lib/select";

export default defineCommand({
  meta: {
    name: "doctor",
    description: "Report what is missing, behind, or broken. Changes nothing",
  },
  args: {
    components: {
      type: "positional",
      required: false,
      description: `all, or any of: ${COMPONENTS.join(", ")}. Defaults to what setup installed.`,
    },
    all: {
      type: "boolean",
      description: "Every component, whatever setup installed",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print the findings as JSON",
      default: false,
    },
  },
  async run({ args }) {
    const components = await selected(args._, args.all).catch(fail);

    if (args.json) {
      const inspection = await inspect(components).catch(fail);
      // The fixes hold closures, so send the part that survives JSON.
      console.log(
        JSON.stringify(
          {
            components,
            findings: allFindings(inspection).map(
              ({ kind, name, status, detail, fix }) => ({
                kind,
                name,
                status,
                detail,
                fix: fix?.label ?? null,
                automatic: fix ? fix.run !== "manual" : false,
              }),
            ),
          },
          null,
          2,
        ),
      );
      return;
    }

    p.intro(bold("abed-hub doctor"));

    const s = spinner();
    s.start("Checking packages, skills, and tools");
    const inspection = await inspect(components).catch((err) => {
      s.stop("Failed");
      return fail(err);
    });
    s.stop("Checked");

    printInspection(inspection);

    const findings = allFindings(inspection);
    const trouble = summarize(findings);
    if (!trouble) {
      p.outro("Everything is here and up to date.");
      return;
    }

    printManual(
      findings
        .filter((f) => f.status !== "ok" && f.fix?.run === "manual")
        .map((f) =>
          f.fix?.run === "manual" && f.fix.hint
            ? `${f.fix.label}${dim(`    # ${f.fix.hint}`)}`
            : (f.fix?.label ?? ""),
        ),
    );

    const missing = count(findings, "missing");
    const next = missing > 0 ? "abed-hub setup" : "abed-hub update";
    p.outro(`${trouble}. ${bold(next)} fixes what it can.`);
    process.exit(1);
  },
});
