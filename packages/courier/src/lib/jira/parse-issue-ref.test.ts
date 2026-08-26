import { describe, expect, test } from "bun:test";
import { adfToText } from "./adf";
import { parseIssueRef } from "./parse-issue-ref";

describe("parseIssueRef", () => {
  test("parses bare issue key", () => {
    expect(parseIssueRef("ABC-123")).toEqual({ key: "ABC-123" });
  });

  test("parses service desk URL", () => {
    expect(
      parseIssueRef(
        "https://acme.atlassian.net/jira/servicedesk/projects/ABC/queues/issue/ABC-123",
      ),
    ).toEqual({
      key: "ABC-123",
      baseUrl: "https://acme.atlassian.net",
    });
  });

  test("parses browse URL", () => {
    expect(parseIssueRef("https://acme.atlassian.net/browse/ABC-123")).toEqual({
      key: "ABC-123",
      baseUrl: "https://acme.atlassian.net",
    });
  });
});

describe("adfToText", () => {
  test("extracts paragraph text", () => {
    expect(
      adfToText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      }).trim(),
    ).toBe("Hello world");
  });
});
