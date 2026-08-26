import { defineCommand } from "citty";
import { cancel } from "../../lib/cli";
import { setupConfig } from "../../lib/slack/config";

export default defineCommand({
  meta: {
    name: "setup",
    description:
      "Create the Slack app if needed, then save and validate its bot token",
  },
  async run() {
    const config = await setupConfig();
    if (!config) cancel();
  },
});
