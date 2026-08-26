import { defineCommand } from "citty";
import { fail } from "../../lib/cli";
import { resolveThread } from "../../lib/slack/resolve-thread";
import { tryCatch } from "../../lib/try-catch";

export default defineCommand({
  meta: {
    name: "permalink",
    description: "Print the canonical permalink for a channel id and timestamp",
  },
  args: {
    channel: {
      type: "positional",
      description: "Channel id (e.g. C0BES8Q6YTT)",
      required: false,
    },
    ts: {
      type: "positional",
      description: "Message timestamp (e.g. 1784898961.624539)",
      required: false,
    },
    json: {
      type: "boolean",
      description: "Print the permalink as JSON",
      default: false,
    },
  },
  async run({ args }) {
    const { channel, ts, client } = await resolveThread(args.channel, args.ts);

    const { data: permalink, error } = await tryCatch(
      client.getPermalink(channel, ts),
    );
    if (error) fail(error);

    console.log(
      args.json
        ? JSON.stringify({ channel, ts, permalink }, null, 2)
        : permalink,
    );
  },
});
