import { describe, expect, test } from "bun:test";
import {
  assertReadableChannel,
  parseMessageRef,
  parsePostTarget,
} from "./parse-message-ref";

describe("parseMessageRef", () => {
  test("parses a permalink", () => {
    expect(
      parseMessageRef(
        "https://acme.slack.com/archives/C0BES8Q6YTT/p1784898961624539",
      ),
    ).toEqual({ channel: "C0BES8Q6YTT", ts: "1784898961.624539" });
  });

  test("inserts the dot exactly 6 digits from the end", () => {
    // p + 10-digit epoch + 6-digit sequence. Off by one here and Slack 404s.
    const { ts } = parseMessageRef(
      "https://acme.slack.com/archives/C0BES8Q6YTT/p1752160000123456",
    );
    expect(ts).toBe("1752160000.123456");
    expect(ts.split(".")[1]).toHaveLength(6);
    expect(Number(ts.split(".")[0])).toBe(1752160000);
  });

  test("prefers the thread parent and keeps the linked reply as focusTs", () => {
    expect(
      parseMessageRef(
        "https://acme.slack.com/archives/C0BES8Q6YTT/p1784898961624539?thread_ts=1784898000.000100&cid=C0BES8Q6YTT",
      ),
    ).toEqual({
      channel: "C0BES8Q6YTT",
      ts: "1784898000.000100",
      focusTs: "1784898961.624539",
    });
  });

  test("ignores thread_ts when it is the linked message itself", () => {
    expect(
      parseMessageRef(
        "https://acme.slack.com/archives/C0BES8Q6YTT/p1784898961624539?thread_ts=1784898961.624539",
      ),
    ).toEqual({ channel: "C0BES8Q6YTT", ts: "1784898961.624539" });
  });

  test("prefers the cid param over the path segment", () => {
    expect(
      parseMessageRef(
        "https://acme.slack.com/archives/C0OTHER123/p1784898961624539?cid=C0BES8Q6YTT",
      ).channel,
    ).toBe("C0BES8Q6YTT");
  });

  test("parses a bare channel and timestamp, as one arg or two", () => {
    const expected = { channel: "C0BES8Q6YTT", ts: "1784898961.624539" };
    expect(parseMessageRef("C0BES8Q6YTT 1784898961.624539")).toEqual(expected);
    expect(parseMessageRef("C0BES8Q6YTT", "1784898961.624539")).toEqual(
      expected,
    );
  });

  test("parses private channel and DM ids", () => {
    expect(parseMessageRef("G012345 1784898961.624539").channel).toBe(
      "G012345",
    );
    expect(
      parseMessageRef(
        "https://acme.slack.com/archives/D012345/p1784898961624539",
      ).channel,
    ).toBe("D012345");
  });

  test("rejects junk", () => {
    expect(() => parseMessageRef("")).toThrow(/required/);
    expect(() => parseMessageRef("not a link")).toThrow(/Could not parse/);
    expect(() => parseMessageRef("C0BES8Q6YTT 1784898961")).toThrow(
      /Not a Slack timestamp/,
    );
    expect(() => parseMessageRef("https://acme.slack.com/team/U123")).toThrow(
      /Not a Slack message permalink/,
    );
    expect(() =>
      parseMessageRef("https://acme.slack.com/archives/C0BES8Q6YTT"),
    ).toThrow(/no message timestamp/);
  });
});

describe("parsePostTarget", () => {
  test("a bare channel id posts top-level", () => {
    expect(parsePostTarget("C0BES8Q6YTT")).toEqual({ channel: "C0BES8Q6YTT" });
    expect(parsePostTarget("c0bes8q6ytt")).toEqual({ channel: "C0BES8Q6YTT" });
  });

  test("a permalink replies under the message it points at", () => {
    expect(
      parsePostTarget(
        "https://acme.slack.com/archives/C0BES8Q6YTT/p1784898961624539",
      ),
    ).toEqual({ channel: "C0BES8Q6YTT", threadTs: "1784898961.624539" });
  });

  test("a link to a reply threads under the parent, the only ts Slack accepts", () => {
    expect(
      parsePostTarget(
        "https://acme.slack.com/archives/C0BES8Q6YTT/p1784898961624539?thread_ts=1784898000.000100",
      ),
    ).toEqual({ channel: "C0BES8Q6YTT", threadTs: "1784898000.000100" });
  });

  test("--thread wins over a channel id and over a permalink's ts", () => {
    expect(parsePostTarget("C0BES8Q6YTT", "1784898000.000100")).toEqual({
      channel: "C0BES8Q6YTT",
      threadTs: "1784898000.000100",
    });
    expect(
      parsePostTarget(
        "https://acme.slack.com/archives/C0BES8Q6YTT/p1784898961624539",
        "1784898000.000100",
      ).threadTs,
    ).toBe("1784898000.000100");
  });

  test("rejects junk", () => {
    expect(() => parsePostTarget("")).toThrow(/required/);
    expect(() => parsePostTarget("#general")).toThrow(
      /Channel names cannot be/,
    );
    expect(() => parsePostTarget("U07NXFDA41X")).toThrow(/is a user id/);
    expect(() => parsePostTarget("C0BES8Q6YTT", "1784898961")).toThrow(
      /Not a Slack timestamp/,
    );
  });
});

describe("assertReadableChannel", () => {
  test("rejects DMs, which a bot token cannot read", () => {
    expect(() => assertReadableChannel("D012345")).toThrow(
      /cannot read human-to-human DMs/,
    );
  });

  test("allows public and private channels", () => {
    expect(() => assertReadableChannel("C0BES8Q6YTT")).not.toThrow();
    expect(() => assertReadableChannel("G012345")).not.toThrow();
  });
});
