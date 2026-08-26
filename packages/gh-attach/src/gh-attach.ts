#! /usr/bin/env bun

import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "gh-attach",
    description:
      "Upload local files to GitHub and print a reference you can embed in a pull request or issue.",
  },
  // Lazy loaded so only the command being run gets imported.
  subCommands: {
    upload: () => import("./commands/upload").then((m) => m.default),
    shot: () => import("./commands/shot").then((m) => m.default),
    token: () => import("./commands/token").then((m) => m.default),
  },
});

runMain(main);
