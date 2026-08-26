import { mkdir } from "node:fs/promises";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { fail, spinner } from "../../lib/cli";
import { resolveThread } from "../../lib/slack/resolve-thread";
import { tryCatch } from "../../lib/try-catch";
import { formatBytes } from "../../lib/utils";

export default defineCommand({
  meta: {
    name: "pull",
    alias: ["download"],
    description: "Download every file attached to a Slack thread",
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
    out: {
      type: "string",
      description: "Directory to download into (default: a fresh temp dir)",
    },
    json: {
      type: "boolean",
      description: "Print the downloaded files as JSON",
      default: false,
    },
  },
  async run({ args }) {
    const { channel, ts, client } = await resolveThread(args.link, args.ts);

    const s = spinner();
    s.start(`Fetching thread ${ts}`);

    const { data: messages, error: threadError } = await tryCatch(
      client.getThread(channel, ts),
    );
    if (threadError) {
      s.stop("Failed");
      fail(threadError);
    }

    const fileCount = messages.reduce(
      (total, message) => total + message.files.length,
      0,
    );
    if (fileCount === 0) {
      s.stop("No files in that thread");
      if (args.json) console.log("[]");
      return;
    }

    s.message(`Downloading ${fileCount} file(s)`);

    if (args.out) {
      const { error } = await tryCatch(mkdir(args.out, { recursive: true }));
      if (error) {
        s.stop("Failed");
        fail(error);
      }
    }

    const { data: result, error } = await tryCatch(
      client.downloadThreadFiles(messages, args.out),
    );
    if (error) {
      s.stop("Failed");
      fail(error);
    }

    s.stop(`Downloaded ${result.downloaded.length} file(s) to ${result.dir}`);

    if (args.json) {
      console.log(
        JSON.stringify(
          result.downloaded.map((file) => ({
            id: file.id,
            name: file.name ?? file.title,
            mimetype: file.mimetype,
            size: file.size,
            author: file.author,
            localPath: file.localPath,
          })),
          null,
          2,
        ),
      );
      return;
    }

    for (const file of result.downloaded) {
      const meta = [
        file.mimetype,
        file.size != null ? formatBytes(file.size) : null,
      ]
        .filter(Boolean)
        .join(", ");
      console.log(`→ ${file.localPath}${meta ? ` (${meta})` : ""}`);
    }

    for (const file of result.skipped) {
      p.log.warn(`Skipped ${file.name ?? file.id}: ${file.reason}`);
    }

    p.log.info(`Attach them with: jira attach <KEY> ${result.dir}/*`);
  },
});
