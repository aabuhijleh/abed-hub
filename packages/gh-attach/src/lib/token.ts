import { readFile, toolFile, writeFile } from "@abed-hub/config";
import { run } from "./run";

/**
 * gh-attach uploads through the `gh image` extension, which authenticates with a
 * GitHub browser session cookie rather than an API token. The cookie expires
 * every few weeks, so this module owns getting a live one:
 *
 *   1. validate the cookie on disk
 *   2. if it is dead, extract a fresh one from the browser cookie store
 *   3. validate that, and only then write it
 *
 * Extraction reads the browser's cookie store, which on macOS needs the
 * "Chrome Safe Storage" Keychain item and therefore a logged-in desktop session.
 * Nothing here runs unattended and nothing installs a scheduled job: the cookie
 * is refreshed when an upload needs it.
 */
const TOOL = "gh-attach";
const FILE = "token";

/** Minimum `gh image` version. Older builds have no check-token subcommand. */
const MIN_EXTENSION = { major: 1, minor: 1 };

export function tokenPath(): string {
  return toolFile(TOOL, FILE);
}

export class TokenError extends Error {}

function fail(message: string): never {
  throw new TokenError(message);
}

/** Everything that must be true before an upload can be attempted. */
export async function assertPrerequisites(): Promise<void> {
  const version = await run(["gh", "--version"], { timeoutMs: 10_000 }).catch(
    () => null,
  );
  if (version?.code !== 0) {
    fail("gh is not on PATH. Install it: https://cli.github.com");
  }

  const auth = await run(["gh", "auth", "status"], { timeoutMs: 15_000 });
  if (auth.code !== 0) fail("gh is not authenticated. Run: gh auth login");

  const ext = await run(["gh", "image", "--version"], { timeoutMs: 15_000 });
  if (ext.code !== 0) {
    fail(
      "The gh-image extension is missing. Install it: gh extension install drogers0/gh-image",
    );
  }

  const printed = `${ext.stdout}${ext.stderr}`;
  if (/\bdev\b/.test(printed)) return; // local dev build, version string is not comparable

  const found = printed.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!found) return;

  const major = Number(found[1]);
  const minor = Number(found[2]);
  const tooOld =
    major < MIN_EXTENSION.major ||
    (major === MIN_EXTENSION.major && minor < MIN_EXTENSION.minor);
  if (tooOld) {
    fail(
      `gh-image ${found[0]} is too old, need ${MIN_EXTENSION.major}.${MIN_EXTENSION.minor}.0 or later. Run: gh extension upgrade gh-image`,
    );
  }
}

/** Check a candidate cookie without printing it. Returns the GitHub username. */
async function validate(candidate: string): Promise<string | null> {
  const result = await run(["gh", "image", "check-token"], {
    env: { GH_SESSION_TOKEN: candidate },
  });
  if (result.code !== 0) return null;
  const lines = `${result.stdout}`.trim().split("\n");
  return lines[lines.length - 1]?.trim() || null;
}

/** Pull a fresh cookie out of the browser cookie store. */
async function extract(): Promise<string> {
  const result = await run(["gh", "image", "extract-token"]);
  if (result.timedOut) {
    fail(
      "extract-token timed out. On macOS this means the Chrome Safe Storage Keychain grant was revoked. Re-grant it and try again.",
    );
  }
  if (result.code !== 0) {
    fail(
      "extract-token failed. Sign in to github.com in your browser, then try again.",
    );
  }
  const token = result.stdout.trim();
  if (!token) {
    fail(
      "extract-token produced nothing. Sign in to github.com in your browser, then try again.",
    );
  }
  return token;
}

/**
 * Warn when the caller's inherited GH_SESSION_TOKEN is not the cookie we just
 * blessed. A long-running process snapshots that variable at launch, so it can
 * outlive the cookie it holds while every child shell keeps inheriting it.
 * gh-attach reads the file and is immune. A bare `gh image` in that shell is not.
 */
function warnStaleEnv(blessed: string): void {
  const ambient = process.env.GH_SESSION_TOKEN;
  if (!ambient || ambient === blessed) return;
  console.error("warning: this shell's inherited GH_SESSION_TOKEN is stale.");
  console.error(
    "Upload with gh-attach, which reads the token file. A bare 'gh image' would not.",
  );
}

export type Token = { token: string; username: string; rotated: boolean };

/**
 * Return a cookie GitHub accepts, rotating it first if the stored one is dead.
 * `force` skips the fast path, for the retry after a cookie dies mid-upload.
 */
export async function ensureToken(
  options: { force?: boolean } = {},
): Promise<Token> {
  await assertPrerequisites();

  if (!options.force) {
    const stored = (await readFile(TOOL, FILE))?.trim();
    if (stored) {
      const username = await validate(stored);
      if (username) {
        warnStaleEnv(stored);
        return { token: stored, username, rotated: false };
      }
    }
  }

  const fresh = await extract();
  const username = await validate(fresh);
  if (!username) {
    fail(
      "GitHub rejected the extracted cookie. Sign in again in your browser, then try again.",
    );
  }

  await writeFile(TOOL, FILE, fresh);
  warnStaleEnv(fresh);
  return { token: fresh, username, rotated: true };
}
