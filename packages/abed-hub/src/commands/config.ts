import { configRoot } from "@abed-hub/config";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { fail } from "../lib/cli";
import { bold, dim } from "../lib/color";
import { type ConfigReport, readConfigs } from "../lib/configs";
import { COMPONENTS } from "../lib/registry";
import { selected } from "../lib/select";

/** What goes in the box under the path. */
function body(report: ConfigReport, reveal: boolean): string {
  const { dep, state, raw, value } = report;
  // "`jira setup` and `slack setup` write it", for a file two commands own.
  const writes = dep.setup.map((command) => `\`${command}\``).join(" and ");
  const write = dep.setup.length > 1 ? "write" : "writes";

  switch (state) {
    case "ok":
      return JSON.stringify(value, null, 2);
    case "empty":
      return `{}\n\n${dim(`No settings in it yet. ${writes} ${write} them.`)}`;
    case "unreadable":
      return reveal
        ? `${raw?.trimEnd() ?? ""}\n\n${dim("Not valid JSON, printed as it sits on disk.")}`
        : dim(
            "Not valid JSON, so it cannot be masked. `--reveal` prints it as it sits on disk.",
          );
    case "missing":
      return dim(`Not written yet. ${writes} ${write} it.`);
  }
}

export default defineCommand({
  meta: {
    name: "config",
    description: "Show where every config file lives and what is in it",
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
    reveal: {
      type: "boolean",
      description: "Print tokens in full instead of masking them",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print the paths and contents as JSON",
      default: false,
    },
  },
  async run({ args }) {
    const components = await selected(args._, args.all).catch(fail);
    const reports = await readConfigs(components, {
      reveal: args.reveal,
    }).catch(fail);

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            root: configRoot(),
            components,
            configs: reports.map(({ dep, path, state, value }) => ({
              tool: dep.tool,
              file: dep.file,
              path,
              state,
              config: value,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    p.intro(bold("abed-hub config"));

    for (const report of reports) {
      p.log.step(`${bold(report.path)}${dim(`    # ${report.dep.summary}`)}`);
      p.log.message(body(report, args.reveal));
    }

    // Tokens are the reason the directory is locked down, so say both once.
    const masked = reports.some((report) => report.masked);
    p.outro(
      masked
        ? `Tokens masked. ${bold("--reveal")} prints them in full.`
        : dim(`${configRoot()} is 0700, and every file in it 0600.`),
    );
  },
});
