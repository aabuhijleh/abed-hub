import { cancel, fail, prompt } from "../cli";
import { tryCatchSync } from "../try-catch";
import { createJiraClient, type JiraClient } from "./client";
import { loadConfig } from "./config";
import { parseIssueRef } from "./parse-issue-ref";

/**
 * Resolve a ticket reference (prompting when omitted) into an issue key and a
 * client bound to the right host — the URL's host when one was given, else the
 * configured base URL.
 */
export async function resolveIssue(
  ticket?: string,
): Promise<{ key: string; client: JiraClient }> {
  const config = await loadConfig();
  if (!config) cancel();

  const input =
    ticket ??
    (await prompt({
      message: "Ticket id or URL",
      placeholder: "ABC-123 or https://…/issue/ABC-123",
      validate: (value) => (value?.trim() ? undefined : "Required"),
    }));

  const { data: ref, error } = tryCatchSync(() => parseIssueRef(input));
  if (error) fail(error);

  const client = createJiraClient({
    baseUrl: ref.baseUrl ?? config.ATLASSIAN_BASE_URL,
    email: config.ATLASSIAN_USER_EMAIL,
    apiToken: config.ATLASSIAN_API_TOKEN,
  });

  return { key: ref.key, client };
}
