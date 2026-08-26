import path from "node:path";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { fail, prompt, spinner } from "../../lib/cli";
import { resolveIssue } from "../../lib/jira/resolve-issue";
import { tryCatch } from "../../lib/try-catch";
import { formatBytes } from "../../lib/utils";

export default defineCommand({
  meta: {
    name: "attach",
    alias: ["upload"],
    description: "Upload one or more files as attachments to a Jira issue",
  },
  args: {
    ticket: {
      type: "positional",
      description: "Issue key or URL (e.g. ABC-123). Prompted if omitted.",
      required: false,
    },
    file: {
      type: "positional",
      description: "File(s) to upload. Prompted if omitted.",
      required: false,
    },
    json: {
      type: "boolean",
      description: "Print the created attachments as JSON",
      default: false,
    },
  },
  async run({ args }) {
    // Everything after the ticket is a file path, so read the raw positionals
    // instead of the named args (citty binds one value per positional).
    const [ticket, ...fileArgs] = (args._ ?? []).map(String);

    const { key, client } = await resolveIssue(ticket);

    const files = fileArgs.length
      ? fileArgs
      : [
          await prompt({
            message: "File to upload",
            placeholder: "./screenshot.png",
            validate: (value) => (value?.trim() ? undefined : "Required"),
          }),
        ];

    const paths = files.map((file) => path.resolve(file.trim()));

    const s = spinner();
    s.start(
      `Uploading ${paths.length} file${paths.length === 1 ? "" : "s"} to ${key}`,
    );

    const { data: uploaded, error } = await tryCatch(
      client.addAttachments(key, paths),
    );
    if (error) {
      s.stop("Failed");
      fail(error);
    }

    s.stop(
      `Uploaded ${uploaded.length} attachment${uploaded.length === 1 ? "" : "s"} to ${key}`,
    );

    if (args.json) {
      console.log(JSON.stringify(uploaded, null, 2));
      return;
    }

    p.note(
      uploaded
        .map((a) => {
          const meta = [a.mimeType, a.size != null ? formatBytes(a.size) : null]
            .filter(Boolean)
            .join(", ");
          return `  • ${a.filename}${meta ? ` (${meta})` : ""}`;
        })
        .join("\n"),
      key,
    );
  },
});
