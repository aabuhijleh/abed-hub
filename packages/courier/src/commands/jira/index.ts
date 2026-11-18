import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "jira",
    description:
      "Read a Jira issue, download its attachments, and upload files back.",
  },
  // Lazy loaded so only the command being run gets imported.
  subCommands: {
    show: () => import("./show").then((m) => m.default),
    attach: () => import("./attach").then((m) => m.default),
    config: () => import("./config").then((m) => m.default),
    setup: () => import("./setup").then((m) => m.default),
  },
});
