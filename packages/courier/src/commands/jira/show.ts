import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { fail, spinner } from "../../lib/cli";
import { resolveIssue } from "../../lib/jira/resolve-issue";
import { tryCatch } from "../../lib/try-catch";
import { formatBytes } from "../../lib/utils";

export default defineCommand({
  meta: {
    name: "show",
    alias: ["get", "view"],
    description:
      "Fetch a Jira issue by key or URL and download its attachments",
  },
  args: {
    ticket: {
      type: "positional",
      description: "Issue key or URL (e.g. ABC-123). Prompted if omitted.",
      required: false,
    },
    json: {
      type: "boolean",
      description: "Print issue data as JSON",
      default: false,
    },
  },
  async run({ args }) {
    const { key, client } = await resolveIssue(args.ticket);

    const s = spinner();
    s.start(`Fetching ${key}`);

    const { data: issue, error } = await tryCatch(client.getIssue(key));
    if (error) {
      s.stop("Failed");
      fail(error);
    }

    s.stop(`Fetched ${issue.key}`);

    if (args.json) {
      console.log(JSON.stringify(issue, null, 2));
      return;
    }

    const downloaded = issue.attachments.filter((a) => a.localPath);

    p.note(
      [
        `Title: ${issue.title}`,
        `Reporter: ${
          issue.reporter
            ? `${issue.reporter.displayName}${
                issue.reporter.emailAddress
                  ? ` <${issue.reporter.emailAddress}>`
                  : ""
              }`
            : "(unknown)"
        }`,
        "",
        "Description:",
        issue.description || "(none)",
        "",
        "Link:",
        issue.link || "(none)",
        "",
        `Attachments (${issue.attachments.length}):`,
        issue.attachments.length
          ? issue.attachments
              .map((a) => {
                const meta = [
                  a.mimeType,
                  a.size != null ? formatBytes(a.size) : null,
                ]
                  .filter(Boolean)
                  .join(", ");
                const lines = [`  • ${a.filename}${meta ? ` (${meta})` : ""}`];
                if (a.localPath) lines.push(`    → ${a.localPath}`);
                return lines.join("\n");
              })
              .join("\n")
          : "  (none)",
        ...(issue.attachmentsDir
          ? [
              "",
              `Attachments saved to: ${issue.attachmentsDir} (${downloaded.length})`,
            ]
          : []),
      ].join("\n"),
      issue.key,
    );
  },
});
