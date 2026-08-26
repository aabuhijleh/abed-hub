import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { fail, spinner } from "../../lib/cli";
import { isNativeDoc } from "../../lib/slack/client";
import { resolveThread } from "../../lib/slack/resolve-thread";
import { tryCatch } from "../../lib/try-catch";
import { formatBytes } from "../../lib/utils";

export default defineCommand({
  meta: {
    name: "thread",
    alias: ["show", "read"],
    description:
      "Print a Slack thread verbatim, with its files and canonical permalink",
  },
  args: {
    link: {
      type: "positional",
      description: "Slack permalink, or a channel id. Prompted if omitted.",
      required: false,
    },
    ts: {
      type: "positional",
      description:
        "Message timestamp, when a channel id was given instead of a permalink",
      required: false,
    },
    json: {
      type: "boolean",
      description: "Print the thread as JSON",
      default: false,
    },
  },
  async run({ args }) {
    const { channel, ts, focusTs, client } = await resolveThread(
      args.link,
      args.ts,
    );

    const s = spinner();
    s.start(`Fetching thread ${ts}`);

    const { data, error } = await tryCatch(
      Promise.all([
        client.getThread(channel, ts),
        client.getPermalink(channel, ts),
      ]),
    );
    if (error) {
      s.stop("Failed");
      fail(error);
    }

    const [messages, permalink] = data;
    s.stop(`Fetched ${messages.length} message(s)`);

    if (args.json) {
      console.log(
        JSON.stringify({ channel, ts, focusTs, permalink, messages }, null, 2),
      );
      return;
    }

    p.note(
      messages
        .map((message) => {
          const marker = message.ts === focusTs ? " ← linked message" : "";
          const lines = [
            `${message.author} · ${message.date}${marker}`,
            message.text || "(no text)",
          ];

          if (message.files.length > 0) {
            lines.push(
              ...message.files.map((file) => {
                const meta = [
                  file.mimetype,
                  file.size != null ? formatBytes(file.size) : null,
                  isNativeDoc(file) ? "Slack doc, not downloadable" : null,
                ]
                  .filter(Boolean)
                  .join(", ");
                return `  • ${file.id} · ${file.name ?? file.title ?? "(unnamed)"}${meta ? ` (${meta})` : ""}`;
              }),
            );
          }

          return lines.join("\n");
        })
        .join("\n\n"),
      permalink,
    );

    p.log.info(`Source: ${permalink}`);
  },
});
