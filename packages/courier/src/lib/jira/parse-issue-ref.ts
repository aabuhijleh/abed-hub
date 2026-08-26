import { tryCatchSync } from "../try-catch";

const ISSUE_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/i;

export type IssueRef = {
  key: string;
  /** Override base URL when the input was a full Atlassian URL. */
  baseUrl?: string;
};

/**
 * Accepts a bare issue key (ABC-123) or a Jira/Service Desk URL and
 * returns the issue key (and host when present in the URL).
 */
export function parseIssueRef(input: string): IssueRef {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Issue id or URL is required");
  }

  const match = trimmed.match(ISSUE_KEY_RE);
  if (!match?.[1]) {
    throw new Error(`Could not find an issue key in: ${trimmed}`);
  }

  const key = match[1].toUpperCase();

  const { data: url } = tryCatchSync(() => new URL(trimmed));
  if (url?.hostname.endsWith(".atlassian.net")) {
    return { key, baseUrl: `${url.protocol}//${url.host}` };
  }

  return { key };
}
