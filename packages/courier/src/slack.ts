#! /usr/bin/env bun

import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "slack",
    description:
      "Read a Slack thread, download its files, and post or delete messages as the bot.",
  },
  // Lazy loaded so only the command being run gets imported.
  subCommands: {
    thread: () => import("./commands/slack/thread").then((m) => m.default),
    pull: () => import("./commands/slack/pull").then((m) => m.default),
    post: () => import("./commands/slack/post").then((m) => m.default),
    delete: () => import("./commands/slack/delete").then((m) => m.default),
    permalink: () =>
      import("./commands/slack/permalink").then((m) => m.default),
    config: () => import("./commands/slack/config").then((m) => m.default),
    setup: () => import("./commands/slack/setup").then((m) => m.default),
  },
});

runMain(main);
