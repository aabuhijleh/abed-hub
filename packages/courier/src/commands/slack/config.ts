import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { getConfigPath, maskToken } from "../../lib/config";
import { readConfigFile } from "../../lib/slack/config";

export default defineCommand({
  meta: {
    name: "config",
    description: "Show the config file path and the saved Slack settings",
  },
  args: {
    reveal: {
      type: "boolean",
      description: "Print the bot token in full instead of masking it",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print the config as JSON",
      default: false,
    },
  },
  async run({ args }) {
    // Read first: it is what migrates a pre-rename config into place.
    const config = await readConfigFile();
    const configPath = getConfigPath();
    const exists = await Bun.file(configPath).exists();

    if (!config) {
      const reason = exists
        ? `No valid \`slack\` section in ${configPath}`
        : `No config found at ${configPath}`;
      if (args.json) {
        console.log(
          JSON.stringify({ path: configPath, config: null }, null, 2),
        );
      } else {
        p.log.warn(`${reason}. Run \`slack setup\` to create one.`);
      }
      return;
    }

    const token = args.reveal
      ? config.SLACK_BOT_TOKEN
      : maskToken(config.SLACK_BOT_TOKEN);

    if (args.json) {
      console.log(
        JSON.stringify(
          { path: configPath, config: { ...config, SLACK_BOT_TOKEN: token } },
          null,
          2,
        ),
      );
      return;
    }

    p.note(
      [
        `SLACK_BOT_TOKEN: ${token}`,
        `SLACK_WORKSPACE: ${config.SLACK_WORKSPACE ?? "(unknown)"}`,
        ...(args.reveal ? [] : ["", "Pass --reveal to print the full token."]),
      ].join("\n"),
      configPath,
    );
  },
});
