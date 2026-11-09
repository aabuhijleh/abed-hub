import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const script = path.join(import.meta.dir, "stack.sh");

const stack = {
  number: 7,
  url: "https://api.github.com/repos/owner/repo/stacks/7",
  base: { ref: "main" },
  pull_requests: [{ number: 5 }, { number: 6 }],
};

let bin: string;
let calls: string;

// A fake gh with stack 7 holding PRs 5 and 6, PR 8 outside any stack, and branch feat/a on PR 6.
beforeEach(async () => {
  bin = await mkdtemp(path.join(tmpdir(), "gh-stack-stack-"));
  calls = path.join(bin, "calls.log");
  await writeFile(path.join(bin, "stack.json"), JSON.stringify(stack));
  await writeFile(
    path.join(bin, "gh"),
    `#!/usr/bin/env bash
printf '%s|%s\\n' "\${GH_REPO:-}" "$*" >> "${calls}"
not_found() { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }
case "$*" in
  *stacks/7) cat "${bin}/stack.json" ;;
  *stacks/*) not_found ;;
  *"pull_request=5"*|*"pull_request=6"*) echo "[$(cat "${bin}/stack.json")]" ;;
  *"pull_request="*) echo "[]" ;;
  "pr view feat/a "*) echo 6 ;;
  "pr view 8 "*) echo feat/base ;;
  "pr view "*) exit 1 ;;
  "repo view "*) echo main ;;
esac
`,
  );
  await chmod(path.join(bin, "gh"), 0o755);
});

afterEach(async () => {
  await rm(bin, { recursive: true, force: true });
});

async function resolve(target: string) {
  const run = Bun.spawnSync(["bash", script, target], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GH_REPO: "" },
  });
  const out = run.stdout.toString();
  return {
    code: run.exitCode,
    stack: out ? JSON.parse(out) : null,
    err: run.stderr.toString(),
    calls: (await readFile(calls, "utf8")).trim().split("\n"),
  };
}

describe("stack.sh", () => {
  test.each(["7", "#7", "https://github.com/acme/app/stack/7"])(
    "%s names the whole stack, with no PR marked",
    async (target) => {
      const { code, stack } = await resolve(target);
      expect(code).toBe(0);
      expect(stack.number).toBe(7);
      expect(stack.target).toBeNull();
      expect(stack.repo).toBe("owner/repo");
    },
  );

  test.each([
    ["5", 5],
    ["#6", 6],
    ["https://github.com/acme/app/pull/6", 6],
    ["feat/a", 6],
  ])("%s finds the stack its PR is in and marks the PR", async (target, pr) => {
    const { code, stack } = await resolve(target);
    expect(code).toBe(0);
    expect(stack.number).toBe(7);
    expect(stack.target).toBe(pr);
  });

  test("a URL points every call at its repo", async () => {
    const { calls } = await resolve("https://github.com/acme/app/pull/6");
    expect(calls.every((c) => c.startsWith("acme/app|"))).toBe(true);
  });

  test("a PR in no stack exits 2 and names a hand-built chain", async () => {
    const { code, err } = await resolve("8");
    expect(code).toBe(2);
    expect(err).toContain("PR #8 is not in a stack on GitHub.");
    expect(err).toContain("Its base is 'feat/base', not 'main'");
  });

  test.each([
    ["99", "No pull request or stack #99."],
    ["https://github.com/acme/app/stack/99", "No stack #99"],
    ["feat/none", "No pull request or stack for 'feat/none'."],
  ])("%s that matches nothing exits 2", async (target, message) => {
    const { code, err } = await resolve(target);
    expect(code).toBe(2);
    expect(err).toContain(message);
  });
});
