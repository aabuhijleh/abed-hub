import { defineCommand } from "citty";
import { run } from "../lib/run";
import { ensureToken, TokenError } from "../lib/token";

/**
 * GitHub answers an upload made with a logged-out cookie with its login page,
 * which the extension reports as this. It cannot tell that apart from a real
 * permission problem, so it guesses at write access and SAML SSO. Neither is
 * ever the cause, so gh-attach rotates and retries instead of repeating a guess.
 */
const STALE = "uploadToken not found";

async function upload(
  files: string[],
  repo: string | undefined,
  token: string,
) {
  const args = ["gh", "image", ...files];
  if (repo) args.push("--repo", repo);
  return run(args, { env: { GH_SESSION_TOKEN: token }, timeoutMs: 300_000 });
}

export default defineCommand({
  meta: {
    name: "upload",
    description:
      "Upload files to GitHub and print an embeddable reference for each",
  },
  args: {
    files: {
      type: "positional",
      required: true,
      description: "One or more local files: image, video, PDF, zip, log",
    },
    repo: {
      type: "string",
      description:
        "Target repository as owner/repo. Defaults to the current one.",
    },
  },
  async run({ args, rawArgs }) {
    // citty collects a single positional; take every non-flag argument instead.
    const files: string[] = [];
    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];
      if (arg === undefined) continue;
      if (arg === "--repo") {
        i++;
        continue;
      }
      if (arg.startsWith("-")) continue;
      files.push(arg);
    }
    if (files.length === 0) {
      console.error("gh-attach: no files given");
      process.exit(2);
    }

    const repo = typeof args.repo === "string" ? args.repo : undefined;

    let token: string;
    try {
      token = (await ensureToken()).token;
    } catch (error) {
      if (error instanceof TokenError) {
        console.error(`gh-attach: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    let result = await upload(files, repo, token);

    // A cookie can pass the check and be dead seconds later, at the upload's own
    // page fetch. Rotate unconditionally and retry once, so the caller never has
    // to interpret that message.
    if (result.code !== 0 && result.stderr.includes(STALE)) {
      console.error(
        "gh-attach: the cookie went stale mid-run, rotating and retrying once",
      );
      try {
        const fresh = await ensureToken({ force: true });
        result = await upload(files, repo, fresh.token);
      } catch (error) {
        if (error instanceof TokenError) {
          console.error(`gh-attach: ${error.message}`);
          process.exit(1);
        }
        throw error;
      }
    }

    if (result.stdout) process.stdout.write(result.stdout);

    if (result.code !== 0 && result.stderr.includes(STALE)) {
      console.error(
        "gh-attach: the upload failed on a stale GitHub session cookie, twice.",
      );
      console.error(
        "  This is not a permissions, SAML SSO, or account problem.",
      );
      console.error("  The browser session is signed out or expired.");
      console.error(
        "  Sign in to github.com in your browser, then run this again.",
      );
      process.exit(result.code);
    }

    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.code);
  },
});
