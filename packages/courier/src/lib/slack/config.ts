import * as p from "@clack/prompts";
import { z } from "zod";
import { getConfigPath, readSection, writeSection } from "../config";
import { tryCatch, tryCatchSync } from "../try-catch";
import { errorMessage } from "../utils";
import { createSlackClient } from "./client";

const SECTION = "slack";

const configSchema = z.object({
  SLACK_BOT_TOKEN: z.string().min(1),
  /** Workspace subdomain, filled in from auth.test. */
  SLACK_WORKSPACE: z.string().optional(),
});

export type SlackConfig = z.infer<typeof configSchema>;

/** Read the saved config, or null when it is missing or invalid. */
export async function readConfigFile(): Promise<SlackConfig | null> {
  return readSection(SECTION, configSchema);
}

/** `https://acme.slack.com/` → `acme` */
function workspaceFromUrl(url: string): string | undefined {
  const { data: parsed } = tryCatchSync(() => new URL(url));
  return parsed?.hostname.split(".")[0];
}

const SCOPES = [
  "channels:history",
  "channels:read",
  "chat:write",
  "files:read",
  "files:write",
  "groups:history",
  "groups:read",
  "users:read",
];

/**
 * Everything a first-time user has to do in the browser before this command can
 * finish. The token itself is the only thing the CLI can ask for; the app and
 * its scopes have to be created at api.slack.com first.
 */
function printSetupGuide(): void {
  p.note(
    [
      "1. Create an app at https://api.slack.com/apps (From scratch), pick your workspace.",
      "2. Open OAuth & Permissions and add these Bot Token Scopes:",
      `     ${SCOPES.join(", ")}`,
      "3. Install to Workspace, then copy the Bot User OAuth Token (xoxb-…).",
      "4. Paste it below.",
      "",
      "Leave public distribution off. Slack drops conversations.history to one",
      "request per minute for distributed apps.",
    ].join("\n"),
    "Create a Slack app",
  );
}

async function promptForConfig(
  existing: SlackConfig | null = null,
): Promise<SlackConfig | null> {
  if (!existing) {
    p.log.info(`No Slack config found. Create one at ${getConfigPath()}`);
    printSetupGuide();
  }

  const token = await p.password({
    message: existing
      ? "SLACK_BOT_TOKEN (leave empty to keep current)"
      : "SLACK_BOT_TOKEN (xoxb-…)",
    validate: (value) => {
      if (!value?.trim()) return existing ? undefined : "Required";
      if (!value.trim().startsWith("xoxb-")) {
        return "Must be a bot token (xoxb-…). A user token cannot be used here.";
      }
      return undefined;
    },
  });
  if (p.isCancel(token)) return null;

  const entered = String(token).trim();
  return {
    SLACK_BOT_TOKEN:
      entered === "" && existing ? existing.SLACK_BOT_TOKEN : entered,
    SLACK_WORKSPACE: existing?.SLACK_WORKSPACE,
  };
}

/**
 * Validate a token against auth.test before saving it, so setup fails loudly
 * instead of leaving a dead token in the config file.
 */
async function verifyAndSave(config: SlackConfig): Promise<SlackConfig | null> {
  const client = createSlackClient({ token: config.SLACK_BOT_TOKEN });
  const { data: auth, error: authError } = await tryCatch(client.authTest());
  if (authError) {
    p.log.error(`Token rejected, nothing saved: ${errorMessage(authError)}`);
    return null;
  }

  const verified: SlackConfig = {
    ...config,
    SLACK_WORKSPACE: workspaceFromUrl(auth.url) ?? config.SLACK_WORKSPACE,
  };

  const { error } = await tryCatch(writeSection(SECTION, verified));
  if (error) {
    p.log.error(`Failed to save config: ${errorMessage(error)}`);
    return null;
  }

  p.log.success(`Authenticated as @${auth.user} in ${auth.team} (${auth.url})`);
  p.log.success(`Saved Slack config to ${getConfigPath()}`);
  p.log.info(
    "The bot only sees channels it has been invited to: /invite @<bot> in each one.",
  );
  return verified;
}

/** Re-run the interactive setup (prefilled from any existing config) and save it. */
export async function setupConfig(): Promise<SlackConfig | null> {
  const config = await promptForConfig(await readConfigFile());
  return config ? verifyAndSave(config) : null;
}

/** Load the `slack` section, prompting and saving if missing. */
export async function loadConfig(): Promise<SlackConfig | null> {
  const existing = await readConfigFile();
  if (existing) return existing;

  const config = await promptForConfig();
  return config ? verifyAndSave(config) : null;
}
