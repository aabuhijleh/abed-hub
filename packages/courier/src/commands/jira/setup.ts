import { defineCommand } from "citty";
import { cancel } from "../../lib/cli";
import { setupConfig } from "../../lib/jira/config";

export default defineCommand({
  meta: {
    name: "setup",
    description: "Save Atlassian credentials, or replace an expired API token",
  },
  async run() {
    const config = await setupConfig();
    if (!config) cancel();
  },
});
