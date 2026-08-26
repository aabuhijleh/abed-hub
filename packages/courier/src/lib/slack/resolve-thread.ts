import { cancel, fail, prompt } from "../cli";
import { tryCatchSync } from "../try-catch";
import { createSlackClient, type SlackClient } from "./client";
import { loadConfig } from "./config";
import {
  assertReadableChannel,
  type MessageRef,
  parseMessageRef,
} from "./parse-message-ref";

/**
 * Resolve a message reference (prompting when omitted) into a channel, a
 * timestamp and a client bound to the configured bot token.
 */
export async function resolveThread(
  link?: string,
  ts?: string,
): Promise<MessageRef & { client: SlackClient }> {
  const config = await loadConfig();
  if (!config) cancel();

  const input =
    link ??
    (await prompt({
      message: "Slack permalink",
      placeholder: "https://your-workspace.slack.com/archives/C…/p…",
      validate: (value) => (value?.trim() ? undefined : "Required"),
    }));

  const { data: ref, error } = tryCatchSync(() => {
    const parsed = parseMessageRef(input, ts);
    assertReadableChannel(parsed.channel);
    return parsed;
  });
  if (error) fail(error);

  return {
    ...ref,
    client: createSlackClient({ token: config.SLACK_BOT_TOKEN }),
  };
}
