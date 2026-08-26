import path from "node:path";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { cancel, fail, prompt, spinner } from "../../lib/cli";
import { createSlackClient } from "../../lib/slack/client";
import { loadConfig } from "../../lib/slack/config";
import { parsePostTarget } from "../../lib/slack/parse-message-ref";
import { tryCatch, tryCatchSync } from "../../lib/try-catch";
import { formatBytes } from "../../lib/utils";

export default defineCommand({
  meta: {
    name: "post",
    alias: ["send"],
    description:
      "Post a message to a channel or thread, with files attached to it",
  },
  args: {
    target: {
      type: "positional",
      description:
        "Channel id to post into, or a permalink to reply under. Prompted if omitted.",
      required: false,
    },
    file: {
      type: "positional",
      description: "File(s) to attach, all on the one message",
      required: false,
    },
    message: {
      type: "string",
      alias: "m",
      description: "Message text, as Slack mrkdwn (*bold*, _italic_, `code`)",
    },
    "message-file": {
      type: "string",
      description: "Read the message text from a file instead of --message",
    },
    thread: {
      type: "string",
      description:
        "Reply under this thread ts, overriding any ts in the target",
    },
    json: {
      type: "boolean",
      description: "Print the posted message as JSON",
      default: false,
    },
  },
  async run({ args }) {
    // Everything after the target is a file path, so read the raw positionals
    // instead of the named args (citty binds one value per positional).
    const [targetArg, ...fileArgs] = (args._ ?? []).map(String);

    const config = await loadConfig();
    if (!config) cancel();

    const input =
      targetArg ??
      (await prompt({
        message: "Channel id, or a permalink to reply under",
        placeholder: "C0BES8Q6YTT",
        validate: (value) => (value?.trim() ? undefined : "Required"),
      }));

    const { data: target, error: targetError } = tryCatchSync(() =>
      parsePostTarget(input, args.thread),
    );
    if (targetError) fail(targetError);

    const messageFile = args["message-file"];
    let text = args.message;
    if (messageFile) {
      const { data, error } = await tryCatch(Bun.file(messageFile).text());
      if (error) fail(error);
      text = data;
    }

    const paths = fileArgs.map((file) => path.resolve(file.trim()));
    if (!text?.trim() && paths.length === 0) {
      text = await prompt({
        message: "Message",
        validate: (value) => (value?.trim() ? undefined : "Required"),
      });
    }

    const client = createSlackClient({ token: config.SLACK_BOT_TOKEN });

    const s = spinner();
    s.start(
      target.threadTs
        ? `Replying in ${target.threadTs}`
        : `Posting to ${target.channel}`,
    );

    const { data: result, error } = await tryCatch(
      client.post(target, { text, paths }, (progress) => s.message(progress)),
    );
    if (error) {
      s.stop("Failed");
      fail(error);
    }

    const attached = result.files.length
      ? ` with ${result.files.length} file${result.files.length === 1 ? "" : "s"}`
      : "";
    s.stop(`Posted to ${result.channel}${attached}`);

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            channel: result.channel,
            ts: result.ts,
            permalink: result.permalink,
            threadTs: target.threadTs,
            files: result.files.map(({ id, title, size, localPath }) => ({
              id,
              title,
              size,
              localPath,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    if (result.files.length) {
      p.note(
        result.files
          .map((file) => `  • ${file.title} (${formatBytes(file.size)})`)
          .join("\n"),
        "Attached",
      );
    }

    if (result.permalink) console.log(result.permalink);
  },
});
