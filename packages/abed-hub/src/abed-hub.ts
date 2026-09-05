#! /usr/bin/env bun

import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "abed-hub",
    description:
      "Install the abed-hub tools and skills, find what is behind, and update it.",
  },
  // Lazy loaded so only the command being run gets imported.
  subCommands: {
    setup: () => import("./commands/setup").then((m) => m.default),
    doctor: () => import("./commands/doctor").then((m) => m.default),
    update: () => import("./commands/update").then((m) => m.default),
  },
});

runMain(main);
