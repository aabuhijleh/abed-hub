import { tryCatchSync } from "../try-catch";

const CHANNEL_ID_RE = /^[CGD][A-Z0-9]+$/i;
const TS_RE = /^\d{10}\.\d{1,6}$/;

export type MessageRef = {
  /** Channel/group/DM id, e.g. C0BES8Q6YTT. */
  channel: string;
  /** Thread parent timestamp — what conversations.replies wants. */
  ts: string;
  /**
   * The specific message the link pointed at, when it differs from the thread
   * parent. Callers use it to highlight one reply in a thread.
   */
  focusTs?: string;
};

/** `p1752160000123456` → `1752160000.123456` — the dot goes 6 digits from the end. */
function pathTsToTs(segment: string): string | null {
  const digits = segment.replace(/^p/i, "");
  if (!/^\d{13,}$/.test(digits)) return null;
  return `${digits.slice(0, -6)}.${digits.slice(-6)}`;
}

/**
 * Accepts a Slack permalink, or a bare `<channel> <ts>` pair, and returns the
 * channel plus the timestamp to fetch.
 *
 * For a link to a reply (`?thread_ts=…`) the thread parent becomes `ts` so the
 * whole thread is fetched, and the linked reply is kept as `focusTs`.
 */
export function parseMessageRef(input: string, second?: string): MessageRef {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error(
      "A Slack permalink (or channel id and timestamp) is required",
    );
  }

  // Two bare args: `C0BES8Q6YTT 1752160000.123456`
  const parts = second ? [trimmed, second.trim()] : trimmed.split(/\s+/);
  const [bareChannel, bareTs] = parts;
  if (
    parts.length === 2 &&
    bareChannel &&
    bareTs &&
    CHANNEL_ID_RE.test(bareChannel)
  ) {
    if (!TS_RE.test(bareTs)) {
      throw new Error(
        `Not a Slack timestamp: ${bareTs} (expected 1752160000.123456)`,
      );
    }
    return { channel: bareChannel.toUpperCase(), ts: bareTs };
  }

  const { data: url } = tryCatchSync(() => new URL(trimmed));
  if (!url) {
    throw new Error(
      `Could not parse: ${trimmed}. Pass a Slack permalink, or a channel id and timestamp.`,
    );
  }

  const [, archives, channelSegment, messageSegment] = url.pathname.split("/");
  if (archives !== "archives" || !channelSegment) {
    throw new Error(`Not a Slack message permalink: ${trimmed}`);
  }

  const channel = (url.searchParams.get("cid") ?? channelSegment).toUpperCase();
  const linkedTs = messageSegment ? pathTsToTs(messageSegment) : null;
  if (!linkedTs) {
    throw new Error(`Permalink has no message timestamp: ${trimmed}`);
  }

  const threadTs = url.searchParams.get("thread_ts");
  if (threadTs && TS_RE.test(threadTs) && threadTs !== linkedTs) {
    return { channel, ts: threadTs, focusTs: linkedTs };
  }

  return { channel, ts: linkedTs };
}

/**
 * Where a post lands. A bare channel id posts top-level; a permalink replies
 * under the message it points at — and for a link to a reply that means the
 * thread parent, which is the only ts Slack accepts as `thread_ts`. An explicit
 * `thread` wins over both.
 */
export function parsePostTarget(
  input: string,
  thread?: string,
): { channel: string; threadTs?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error(
      "A channel id (or a Slack permalink to reply under) is required",
    );
  }

  const override = thread?.trim();
  if (override && !TS_RE.test(override)) {
    throw new Error(
      `Not a Slack timestamp: ${override} (expected 1752160000.123456)`,
    );
  }

  if (trimmed.startsWith("#")) {
    throw new Error(
      `Channel names cannot be resolved: pass the channel id for ${trimmed} instead (C… or G…, from the channel's "Copy link").`,
    );
  }

  if (/^[UW][A-Z0-9]+$/i.test(trimmed)) {
    throw new Error(
      `${trimmed} is a user id. This bot posts into channels it has been invited to, not DMs — pass a channel id (C… or G…).`,
    );
  }

  if (CHANNEL_ID_RE.test(trimmed)) {
    return {
      channel: trimmed.toUpperCase(),
      ...(override ? { threadTs: override } : {}),
    };
  }

  const { channel, ts } = parseMessageRef(trimmed);
  return { channel, threadTs: override ?? ts };
}

/** A bot token can read its own DMs only, so `D…` refs are a dead end. */
export function assertReadableChannel(channel: string): void {
  if (channel.toUpperCase().startsWith("D")) {
    throw new Error(
      "That is a DM conversation. A bot token cannot read human-to-human DMs — " +
        "ask the reporter to repost in a channel the bot has been invited to.",
    );
  }
}
