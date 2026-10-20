import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const script = path.join(import.meta.dir, "approve.sh");

const stack = [
  {
    number: 7,
    pull_requests: [
      { number: 10, state: "closed", merged_at: "2026-01-01" },
      { number: 11, state: "open", merged_at: null },
      { number: 12, state: "open", merged_at: null },
      { number: 13, state: "open", merged_at: null },
      { number: 14, state: "open", merged_at: null },
    ],
  },
];

const pr = (
  number: number,
  author: string,
  opts: { draft?: boolean; review?: string } = {},
) => ({
  [`p${number}`]: {
    id: `PR_${number}`,
    number,
    isDraft: opts.draft ?? false,
    author: { login: author },
    viewerLatestReview: opts.review ? { state: opts.review } : null,
  },
});

const repository = {
  ...pr(11, "teammate"),
  ...pr(12, "me"),
  ...pr(13, "teammate", { draft: true }),
  ...pr(14, "teammate", { review: "APPROVED" }),
};

let bin: string;
let calls: string;

// A fake gh that answers the three calls approve.sh makes and logs each one.
beforeEach(async () => {
  bin = await mkdtemp(path.join(tmpdir(), "gh-stack-approve-"));
  calls = path.join(bin, "calls.log");
  await writeFile(path.join(bin, "stacks.json"), JSON.stringify(stack));
  await writeFile(
    path.join(bin, "query.json"),
    JSON.stringify({ data: { viewer: { login: "me" }, repository } }),
  );
  await writeFile(
    path.join(bin, "gh"),
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${calls}"
case "$*" in
  *stacks*) cat "${bin}/stacks.json" ;;
  *mutation*) echo '{}' ;;
  *) cat "${bin}/query.json" ;;
esac
`,
  );
  await chmod(path.join(bin, "gh"), 0o755);
});

afterEach(async () => {
  await rm(bin, { recursive: true, force: true });
});

async function approve(...args: string[]) {
  const run = Bun.spawnSync(["bash", script, ...args], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  const log = await readFile(calls, "utf8").catch(() => "");
  return {
    out: run.stdout.toString().trim().split("\n"),
    calls: log.trim().split("\n"),
  };
}

describe("approve.sh", () => {
  test("approves only what the viewer can and has not, in one mutation", async () => {
    const { out, calls } = await approve(
      "https://github.com/owner/repo/pull/12",
    );
    expect(out).toEqual([
      "📚 Stack #7 as @me",
      "✅ #11 approved",
      "⏭️ #12 yours, and GitHub does not let an author approve",
      "📝 #13 draft, skipped",
      "☑️ #14 already approved by you",
    ]);
    const mutations = calls.filter((c) => c.includes("mutation"));
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toContain('pullRequestId: "PR_11"');
    expect(mutations[0]).not.toContain("PR_12");
    expect(calls).toHaveLength(3);
  });

  test("a dry run approves nothing", async () => {
    const { out, calls } = await approve("12", "--dry-run");
    expect(out[0]).toBe("📚 Stack #7 as @me, dry run");
    expect(out).toContain("✅ #11 would approve");
    expect(calls.some((c) => c.includes("mutation"))).toBe(false);
  });
});
