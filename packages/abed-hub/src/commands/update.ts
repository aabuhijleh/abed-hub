import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { applyFixes } from "../lib/apply";
import { fail, spinner } from "../lib/cli";
import { bold } from "../lib/color";
import { allFindings, inspect } from "../lib/inspect";
import { COMPONENTS } from "../lib/registry";
import { printInspection, printManual } from "../lib/report";
import { selected } from "../lib/select";
import { plural } from "../lib/utils";

export default defineCommand({
  meta: {
    name: "update",
    description: "Upgrade everything that is behind, and repair what is broken",
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
  },
  async run({ args }) {
    p.intro(bold("abed-hub update"));

    const components = await selected(args._, args.all).catch(fail);

    const s = spinner();
    s.start("Checking packages, skills, and tools");
    const inspection = await inspect(components).catch((err) => {
      s.stop("Failed");
      return fail(err);
    });
    s.stop("Checked");

    printInspection(inspection);

    const result = await applyFixes(allFindings(inspection), components, {
      upgrade: true,
    });

    printManual(result.manual);

    if (result.failed.length > 0) {
      p.log.error(
        result.failed.map((f) => `${f.label} (${f.message})`).join("\n"),
      );
      p.outro(`${plural(result.failed.length, "step")} failed.`);
      process.exit(1);
    }

    p.outro(
      result.done.length === 0
        ? "Everything was already up to date."
        : `${plural(result.done.length, "step")} done.`,
    );
  },
});
