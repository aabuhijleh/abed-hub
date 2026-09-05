import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { readJson } from "@abed-hub/config";
import { capture, has } from "./exec";
import type { Finding } from "./finding";
import type { ToolId } from "./registry";
import { compareVersions } from "./utils";

/** `gh --attach`, which gh-attach's whole skill rests on, landed here. */
export const GH_MIN = "2.99.0";

function ghVersion(output: string): string | null {
  return /\d+\.\d+\.\d+/.exec(output.split("\n")[0] ?? "")?.[0] ?? null;
}

async function checkBun(): Promise<Finding> {
  const { ok, stdout } = await capture(["bun", "--version"]);
  if (!ok) {
    return {
      kind: "tool",
      name: "bun",
      status: "missing",
      detail: "installs every package here",
      fix: {
        run: "manual",
        label: "install bun from https://bun.sh",
      },
    };
  }
  return { kind: "tool", name: "bun", status: "ok", detail: stdout.trim() };
}

async function checkGh(): Promise<Finding> {
  const { ok, stdout } = await capture(["gh", "--version"]);
  const version = ok ? ghVersion(stdout) : null;

  if (!version) {
    return {
      kind: "tool",
      name: "gh",
      status: "missing",
      detail: `${GH_MIN} or later`,
      fix: {
        run: "manual",
        label: `install the GitHub CLI ${GH_MIN} or later from https://cli.github.com`,
      },
    };
  }
  if (compareVersions(version, GH_MIN) < 0) {
    return {
      kind: "tool",
      name: "gh",
      status: "stale",
      detail: `${version}, below ${GH_MIN}`,
      fix: {
        run: "manual",
        label: "upgrade the GitHub CLI",
        hint: `--attach landed in ${GH_MIN}`,
      },
    };
  }
  return { kind: "tool", name: "gh", status: "ok", detail: version };
}

async function checkGhAuth(): Promise<Finding> {
  const { ok, stderr, stdout } = await capture(["gh", "auth", "status"]);
  if (!ok) {
    return {
      kind: "tool",
      name: "gh auth",
      status: "broken",
      detail: "signed out",
      fix: { run: "manual", label: "gh auth login" },
    };
  }
  const account = /account (\S+)/.exec(`${stdout}${stderr}`)?.[1];
  return {
    kind: "tool",
    name: "gh auth",
    status: "ok",
    detail: account ? `signed in as ${account}` : "signed in",
  };
}

async function checkGhStackExtension(): Promise<Finding> {
  const { ok, stdout } = await capture(["gh", "extension", "list"]);
  const line = ok
    ? stdout.split("\n").find((l) => l.includes("github/gh-stack"))
    : undefined;

  if (!line) {
    return {
      kind: "tool",
      name: "gh stack",
      status: "missing",
      detail: "the extension gh-stack drives",
      fix: {
        run: "command",
        argv: ["gh", "extension", "install", "github/gh-stack"],
        label: "gh extension install github/gh-stack",
      },
    };
  }

  const installed = /v?\d+\.\d+\.\d+/.exec(line)?.[0];
  const release = await capture([
    "gh",
    "api",
    "repos/github/gh-stack/releases/latest",
  ]);
  let latest: string | undefined;
  if (release.ok) {
    try {
      latest = (JSON.parse(release.stdout) as { tag_name?: string }).tag_name;
    } catch {
      latest = undefined;
    }
  }

  if (installed && latest && compareVersions(installed, latest) < 0) {
    return {
      kind: "tool",
      name: "gh stack",
      status: "stale",
      detail: `${installed} → ${latest}`,
      fix: {
        run: "command",
        argv: ["gh", "extension", "upgrade", "github/gh-stack"],
        label: "gh extension upgrade github/gh-stack",
      },
    };
  }
  return {
    kind: "tool",
    name: "gh stack",
    status: "ok",
    detail: installed ?? "installed",
  };
}

/** Where playwright keeps its browser builds. */
function browserCache(): string {
  const override = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (override) return override;
  if (process.platform === "darwin")
    return path.join(homedir(), "Library/Caches/ms-playwright");
  if (process.platform === "win32")
    return path.join(process.env.LOCALAPPDATA ?? homedir(), "ms-playwright");
  return path.join(
    process.env.XDG_CACHE_HOME ?? path.join(homedir(), ".cache"),
    "ms-playwright",
  );
}

async function checkChromium(): Promise<Finding> {
  const cache = browserCache();
  const build = existsSync(cache)
    ? readdirSync(cache).find((dir) =>
        /^chromium(_headless_shell)?-\d+$/.test(dir),
      )
    : undefined;

  if (build) {
    return { kind: "tool", name: "chromium", status: "ok", detail: build };
  }
  return {
    kind: "tool",
    name: "chromium",
    status: "missing",
    detail: "what gh-attach renders pages with",
    fix: (await has("playwright-cli"))
      ? {
          run: "command",
          argv: ["playwright-cli", "install-browser", "chromium"],
          // Over 350 MB. Hiding the progress bar makes this look hung.
          loud: true,
          label: "playwright-cli install-browser chromium",
        }
      : {
          run: "manual",
          label: "playwright-cli install-browser chromium",
          hint: "install @playwright/cli first",
        },
  };
}

/** Courier writes both sections into one file, and only after `setup` runs. */
async function checkCredentials(which: "jira" | "slack"): Promise<Finding> {
  const config = await readJson<Record<string, unknown>>(
    "courier",
    "config.json",
  );
  const configured = config !== null && config[which] != null;
  return {
    kind: "tool",
    name: `${which} credentials`,
    status: configured ? "ok" : "missing",
    detail: configured ? "configured" : "not configured",
    ...(configured
      ? {}
      : {
          fix: {
            run: "manual" as const,
            label: `${which} setup`,
            hint:
              which === "jira"
                ? "an Atlassian API token"
                : "a Slack app and its bot token",
          },
        }),
  };
}

export function checkTool(id: ToolId): Promise<Finding> {
  switch (id) {
    case "bun":
      return checkBun();
    case "gh":
      return checkGh();
    case "gh-auth":
      return checkGhAuth();
    case "gh-stack-ext":
      return checkGhStackExtension();
    case "chromium":
      return checkChromium();
    case "jira-credentials":
      return checkCredentials("jira");
    case "slack-credentials":
      return checkCredentials("slack");
  }
}
