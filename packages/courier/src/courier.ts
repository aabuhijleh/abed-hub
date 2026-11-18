#! /usr/bin/env bun

import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "courier",
    description:
      "Move files in and out of Jira issues and Slack threads, and post or delete Slack messages.",
  },
  subCommands: {
    jira: () => import("./commands/jira").then((m) => m.default),
    slack: () => import("./commands/slack").then((m) => m.default),
  },
});

runMain(main);
