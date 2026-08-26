#! /usr/bin/env bun

import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "jira",
    description:
      "Read a Jira issue, download its attachments, and upload files back.",
  },
  // Lazy loaded so only the command being run gets imported.
  subCommands: {
    show: () => import("./commands/jira/show").then((m) => m.default),
    attach: () => import("./commands/jira/attach").then((m) => m.default),
    config: () => import("./commands/jira/config").then((m) => m.default),
    setup: () => import("./commands/jira/setup").then((m) => m.default),
  },
});

runMain(main);
