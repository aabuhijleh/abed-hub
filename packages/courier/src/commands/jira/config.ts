import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { getConfigPath, maskToken } from "../../lib/config";
import { readConfigFile } from "../../lib/jira/config";

export default defineCommand({
  meta: {
    name: "config",
    description: "Show the config file path and its contents",
  },
  args: {
    reveal: {
      type: "boolean",
      description: "Print the API token in full instead of masking it",
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
        ? `Config at ${configPath} is invalid or unreadable`
        : `No config found at ${configPath}`;
      if (args.json) {
        console.log(
          JSON.stringify({ path: configPath, config: null }, null, 2),
        );
      } else {
        p.log.warn(`${reason}. Run \`jira setup\` to create one.`);
      }
      return;
    }

    const token = args.reveal
      ? config.ATLASSIAN_API_TOKEN
      : maskToken(config.ATLASSIAN_API_TOKEN);

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            path: configPath,
            config: { ...config, ATLASSIAN_API_TOKEN: token },
          },
          null,
          2,
        ),
      );
      return;
    }

    p.note(
      [
        `ATLASSIAN_BASE_URL:   ${config.ATLASSIAN_BASE_URL}`,
        `ATLASSIAN_USER_EMAIL: ${config.ATLASSIAN_USER_EMAIL}`,
        `ATLASSIAN_API_TOKEN:  ${token}`,
        ...(args.reveal ? [] : ["", "Pass --reveal to print the full token."]),
      ].join("\n"),
      configPath,
    );
  },
});
