#! /usr/bin/env bun

import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "gh-attach",
    description:
      "Screenshot a page to a PNG sized for GitHub, ready to attach to a pull request or issue.",
  },
  // Lazy loaded so only the command being run gets imported.
  subCommands: {
    shot: () => import("./commands/shot").then((m) => m.default),
  },
});

runMain(main);
