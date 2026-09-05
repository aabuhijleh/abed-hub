import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { applyFixes } from "../lib/apply";
import { fail, spinner } from "../lib/cli";
import { bold, dim } from "../lib/color";
import { writeSelection } from "../lib/config";
import { allFindings, inspect } from "../lib/inspect";
import { COMPONENTS } from "../lib/registry";
import { count, printInspection, printManual } from "../lib/report";
import { choose } from "../lib/select";
import { plural } from "../lib/utils";

export default defineCommand({
  meta: {
    name: "setup",
    description: "Install the tools and skills for the components you pick",
  },
  args: {
    components: {
      type: "positional",
      required: false,
      description: `all, or any of: ${COMPONENTS.join(", ")}. Asks if omitted.`,
    },
    all: {
      type: "boolean",
      description: "Every component, without asking",
      default: false,
    },
    force: {
      type: "boolean",
      alias: "f",
      description: "Upgrade what is already installed too",
      default: false,
    },
  },
  async run({ args }) {
    p.intro(bold("abed-hub setup"));

    const components = await choose(args._, args.all).catch(fail);
    await writeSelection(components);
    p.log.info(components.join(", "));

    const s = spinner();
    s.start("Checking what is already here");
    const inspection = await inspect(components).catch((err) => {
      s.stop("Failed");
      return fail(err);
    });
    s.stop("Checked");

    printInspection(inspection);

    const findings = allFindings(inspection);
    const result = await applyFixes(findings, components, {
      upgrade: args.force,
    });

    printManual(result.manual);

    if (result.failed.length > 0) {
      p.log.error(
        result.failed.map((f) => `${f.label} (${f.message})`).join("\n"),
      );
      p.outro(`${plural(result.failed.length, "step")} failed.`);
      process.exit(1);
    }

    // Setup installs what is absent and leaves working versions alone, so say
    // so when it walked past something behind rather than silently skipping it.
    const stale = count(findings, "stale");
    const left =
      args.force || stale === 0
        ? ""
        : dim(` ${stale} behind, left alone. \`abed-hub update\` moves them.`);
    p.outro(
      result.done.length === 0
        ? `Nothing to do.${left}`
        : `${plural(result.done.length, "step")} done.${left}`,
    );
  },
});
