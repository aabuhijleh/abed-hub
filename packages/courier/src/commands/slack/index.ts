import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "slack",
    description:
      "Read a Slack thread, download its files, and post or delete messages as the bot.",
  },
  // Lazy loaded so only the command being run gets imported.
  subCommands: {
    thread: () => import("./thread").then((m) => m.default),
    pull: () => import("./pull").then((m) => m.default),
    post: () => import("./post").then((m) => m.default),
    delete: () => import("./delete").then((m) => m.default),
    permalink: () => import("./permalink").then((m) => m.default),
    config: () => import("./config").then((m) => m.default),
    setup: () => import("./setup").then((m) => m.default),
  },
});
