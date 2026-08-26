import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { cancel, fail, prompt, spinner } from "../../lib/cli";
import { createSlackClient, isNativeDoc } from "../../lib/slack/client";
import { loadConfig } from "../../lib/slack/config";
import { parseMessageRef } from "../../lib/slack/parse-message-ref";
import { tryCatch, tryCatchSync } from "../../lib/try-catch";

export default defineCommand({
  meta: {
    name: "delete",
    alias: ["rm", "unpost"],
    description:
      "Delete the bot's own message(s), optionally with the files they carried",
  },
  args: {
    target: {
      type: "positional",
      description:
        "Permalink(s) of the message(s) to delete. Prompted if omitted.",
      required: false,
    },
    files: {
      type: "boolean",
      description:
        "Delete the attached files too. Without this they leave the channel but stay in the workspace",
      default: false,
    },
    yes: {
      type: "boolean",
      alias: "y",
      description:
        "Skip the confirmation (required when stdin is not a terminal)",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Print what was deleted as JSON",
      default: false,
    },
  },
  async run({ args }) {
    // Every positional is a permalink, so read the raw list rather than the named
    // arg (citty binds one value per positional).
    const targets = (args._ ?? []).map(String).filter((value) => value.trim());

    const config = await loadConfig();
    if (!config) cancel();

    const inputs = targets.length
      ? targets
      : [
          await prompt({
            message: "Permalink of the message to delete",
            placeholder: "https://….slack.com/archives/C…/p…",
            validate: (value) => (value?.trim() ? undefined : "Required"),
          }),
        ];

    const refs = inputs.map((input) => {
      const { data, error } = tryCatchSync(() => parseMessageRef(input));
      if (error) fail(error);
      // A permalink to a reply parses as its thread parent + the reply itself; the
      // delete target is always the message the link pointed at.
      return {
        channel: data.channel,
        parentTs: data.ts,
        ts: data.focusTs ?? data.ts,
      };
    });

    const client = createSlackClient({ token: config.SLACK_BOT_TOKEN });

    // Read each message first: a delete cannot be undone, so the operator sees
    // what is about to go — and the read is what finds the files to go with it.
    const s = spinner();
    s.start(`Reading ${refs.length} message${refs.length === 1 ? "" : "s"}`);
    const found = [];
    for (const ref of refs) {
      const { data, error } = await tryCatch(
        client.getMessage(ref.channel, ref.parentTs, ref.ts),
      );
      if (error) {
        s.stop("Failed");
        fail(error);
      }
      found.push({ ...ref, message: data });
    }
    s.stop(`Read ${found.length} message${found.length === 1 ? "" : "s"}`);

    p.note(
      found
        .map(({ message }) => {
          const first = (message.text.split("\n")[0] ?? "").trim();
          const head =
            first.length > 72 ? `${first.slice(0, 71)}…` : first || "(no text)";
          const files = message.files.length
            ? `\n    ${message.files.length} file(s)${args.files ? " — deleted too" : " — kept"}`
            : "";
          return `  • ${message.author} · ${message.date}\n    ${head}${files}`;
        })
        .join("\n"),
      "About to delete",
    );

    if (!args.yes) {
      if (!process.stdin.isTTY) {
        fail(
          new Error("Not a terminal — pass --yes to delete without confirming"),
        );
      }
      const confirmed = await p.confirm({ message: "Delete permanently?" });
      if (p.isCancel(confirmed) || !confirmed) cancel();
    }

    const deleted: Array<{ channel: string; ts: string; files: string[] }> = [];
    const d = spinner();
    d.start("Deleting");
    for (const { channel, ts, message } of found) {
      const fileIds: string[] = [];
      if (args.files) {
        for (const file of message.files) {
          // A Slack-native doc is not an upload this bot owns; leaving it is the
          // only correct move, and it is never what a rehearsal left behind.
          if (isNativeDoc(file)) continue;
          d.message(`Deleting file ${file.name ?? file.id}`);
          const { error } = await tryCatch(client.deleteFile(file.id));
          if (error) {
            d.stop("Failed");
            fail(error);
          }
          fileIds.push(file.id);
        }
      }

      d.message(`Deleting message ${ts}`);
      const { error } = await tryCatch(client.deleteMessage(channel, ts));
      if (error) {
        d.stop("Failed");
        fail(error);
      }
      deleted.push({ channel, ts, files: fileIds });
    }
    d.stop(
      `Deleted ${deleted.length} message${deleted.length === 1 ? "" : "s"}`,
    );

    if (args.json) {
      console.log(JSON.stringify({ deleted }, null, 2));
    }
  },
});
