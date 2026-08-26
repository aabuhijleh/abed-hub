import { defineCommand } from "citty";
import { ensureToken, TokenError, tokenPath } from "../lib/token";

export default defineCommand({
  meta: {
    name: "token",
    description:
      "Check the stored GitHub session cookie, rotating it if it is dead",
  },
  args: {
    force: {
      type: "boolean",
      description:
        "Re-extract from the browser even when the stored cookie still works",
    },
  },
  async run({ args }) {
    try {
      const { username, rotated } = await ensureToken({
        force: Boolean(args.force),
      });
      console.log(
        rotated ? `rotated, valid as ${username}` : `valid as ${username}`,
      );
      console.log(tokenPath());
    } catch (error) {
      if (error instanceof TokenError) {
        console.error(`gh-attach: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  },
});
