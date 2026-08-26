import * as p from "@clack/prompts";
import { z } from "zod";
import { getConfigPath, readSection, writeSection } from "../config";
import { tryCatch } from "../try-catch";
import { errorMessage } from "../utils";

const SECTION = "jira";

const configSchema = z.object({
  ATLASSIAN_BASE_URL: z.url(),
  ATLASSIAN_USER_EMAIL: z.email(),
  ATLASSIAN_API_TOKEN: z.string().min(1),
});

export type JiraConfig = z.infer<typeof configSchema>;

/** Read the saved config, or null when it is missing or invalid. */
export async function readConfigFile(): Promise<JiraConfig | null> {
  return readSection(SECTION, configSchema);
}

function required(value: string | undefined): string | undefined {
  return value?.trim() ? undefined : "Required";
}

/**
 * Where the API token comes from. Atlassian only shows it once, at creation.
 */
function printSetupGuide(): void {
  p.note(
    [
      "1. Open https://id.atlassian.com/manage-profile/security/api-tokens",
      "2. Create API token, name it courier, and copy it. Atlassian shows it once.",
      "3. Paste it below, with the email address you sign in with.",
    ].join("\n"),
    "Create an Atlassian API token",
  );
}

async function promptForConfig(
  existing: JiraConfig | null = null,
): Promise<JiraConfig | null> {
  if (!existing) {
    p.log.info(`No Jira config found. Create one at ${getConfigPath()}`);
    printSetupGuide();
  }

  const ATLASSIAN_BASE_URL = await p.text({
    message: "ATLASSIAN_BASE_URL",
    placeholder: "https://your-domain.atlassian.net",
    initialValue: existing?.ATLASSIAN_BASE_URL,
    validate: (value) => {
      if (!value?.trim()) return "Required";
      const parsed = z.url().safeParse(value.trim());
      return parsed.success ? undefined : "Must be a valid URL";
    },
  });
  if (p.isCancel(ATLASSIAN_BASE_URL)) return null;

  const ATLASSIAN_USER_EMAIL = await p.text({
    message: "ATLASSIAN_USER_EMAIL",
    placeholder: "you@example.com",
    initialValue: existing?.ATLASSIAN_USER_EMAIL,
    validate: (value) => {
      if (!value?.trim()) return "Required";
      const parsed = z.email().safeParse(value.trim());
      return parsed.success ? undefined : "Must be a valid email";
    },
  });
  if (p.isCancel(ATLASSIAN_USER_EMAIL)) return null;

  const ATLASSIAN_API_TOKEN = await p.password({
    message: existing
      ? "ATLASSIAN_API_TOKEN (leave empty to keep current)"
      : "ATLASSIAN_API_TOKEN",
    validate: existing ? undefined : required,
  });
  if (p.isCancel(ATLASSIAN_API_TOKEN)) return null;

  const token = String(ATLASSIAN_API_TOKEN);
  return {
    ATLASSIAN_BASE_URL: String(ATLASSIAN_BASE_URL).trim().replace(/\/$/, ""),
    ATLASSIAN_USER_EMAIL: String(ATLASSIAN_USER_EMAIL).trim(),
    ATLASSIAN_API_TOKEN:
      token.trim() === "" && existing ? existing.ATLASSIAN_API_TOKEN : token,
  };
}

async function save(config: JiraConfig): Promise<JiraConfig | null> {
  const { error } = await tryCatch(writeSection(SECTION, config));
  if (error) {
    p.log.error(`Failed to save config: ${errorMessage(error)}`);
    return null;
  }

  p.log.success(`Saved Jira config to ${getConfigPath()}`);
  return config;
}

/** Re-run the interactive setup (prefilled from any existing config) and save it. */
export async function setupConfig(): Promise<JiraConfig | null> {
  const config = await promptForConfig(await readConfigFile());
  return config ? save(config) : null;
}

/** Load the `jira` section, prompting and saving if missing. */
export async function loadConfig(): Promise<JiraConfig | null> {
  const existing = await readConfigFile();
  if (existing) return existing;

  const config = await promptForConfig();
  return config ? save(config) : null;
}
