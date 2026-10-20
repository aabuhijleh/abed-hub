import { describe, expect, test } from "bun:test";
import path from "node:path";

const filter = path.join(import.meta.dir, "status.jq");

interface Check {
  name: string;
  conclusion: string;
  isRequired: boolean;
}

function pr(
  number: number,
  base: string,
  opts: {
    behindBase?: number;
    behindTrunk?: number;
    merge?: string;
    checks?: Check[];
  } = {},
) {
  return {
    [`p${number}`]: {
      number,
      headRefName: `feat/layer-${number}`,
      baseRefName: base,
      isDraft: false,
      mergeable: "MERGEABLE",
      mergeStateStatus: opts.merge ?? "CLEAN",
      baseRef: { compare: { behindBy: opts.behindBase ?? 0 } },
      commits: {
        nodes: [
          {
            commit: {
              statusCheckRollup: {
                contexts: {
                  nodes: (opts.checks ?? []).map((check) => ({
                    __typename: "CheckRun",
                    status: "COMPLETED",
                    ...check,
                  })),
                },
              },
            },
          },
        ],
      },
    },
    [`t${number}`]: { compare: { behindBy: opts.behindTrunk ?? 0 } },
  };
}

const stack = {
  number: 7,
  target: 12,
  base: { ref: "main" },
  pull_requests: [
    {
      number: 10,
      state: "closed",
      merged_at: "2026-01-01",
      head: { ref: "a" },
    },
    { number: 11, state: "open", merged_at: null, head: { ref: "b" } },
    { number: 12, state: "open", merged_at: null, head: { ref: "c" } },
  ],
};

function report(prs: object, tracked = true): string[] {
  const run = Bun.spawnSync([
    "jq",
    "-r",
    "-n",
    "--argjson",
    "stack",
    JSON.stringify(stack),
    "--argjson",
    "prs",
    JSON.stringify(prs),
    "--argjson",
    "tracked",
    String(tracked),
    "-f",
    filter,
  ]);
  expect(run.stderr.toString()).toBe("");
  return run.stdout.toString().split("\n");
}

const green: Check = { name: "Build", conclusion: "SUCCESS", isRequired: true };

describe("status report", () => {
  test("places the target PR in the stack", () => {
    const lines = report({ ...pr(11, "main"), ...pr(12, "feat/layer-11") });
    expect(lines[0]).toBe("Stack #7 onto main, bottom to top. #12 is 3 of 3.");
    expect(lines).toContain("  1/3 #10 a: merged");
    expect(
      lines.some((l) => l.startsWith("→ 3/3 #12 c -> feat/layer-11")),
    ).toBe(true);
  });

  test("a current stack says it is up to date", () => {
    const lines = report({
      ...pr(11, "main", { checks: [green] }),
      ...pr(12, "feat/layer-11", { checks: [green] }),
    });
    expect(lines).toContain(
      "Up to date: every open PR contains main and its base, with no conflicts.",
    );
    expect(lines).toContain("Every required check is green.");
  });

  test("names each stale PR and why, then the fix", () => {
    const lines = report(
      {
        ...pr(11, "main", { behindTrunk: 3 }),
        ...pr(12, "feat/layer-11", { behindBase: 2, behindTrunk: 3 }),
      },
      false,
    );
    expect(lines).toContain("Needs updating:");
    expect(lines).toContain("  #11: 3 commits behind main");
    expect(lines).toContain(
      "  #12: 3 commits behind main; 2 commits behind its base feat/layer-11",
    );
    expect(lines).toContain(
      "  Fix: gh stack checkout 7, then gh stack sync (rebases every layer in order, then pushes).",
    );
  });

  test("a failing required check blocks, a failing optional one warns", () => {
    const lines = report({
      ...pr(11, "main", {
        checks: [{ name: "Test", conclusion: "FAILURE", isRequired: true }],
      }),
      ...pr(12, "feat/layer-11", {
        checks: [
          green,
          { name: "Lint", conclusion: "FAILURE", isRequired: false },
        ],
      }),
    });
    expect(lines).toContain("Required checks failing (blocks merge):");
    expect(lines).toContain("  #11: Test");
    expect(lines).toContain(
      "Warning, optional checks failing (merge not blocked):",
    );
    expect(lines).toContain("  #12: Lint");
    expect(lines).not.toContain("Every required check is green.");
  });

  test("blocked with green checks points at a review or rule", () => {
    const lines = report({
      ...pr(11, "main", { merge: "BLOCKED", checks: [green] }),
      ...pr(12, "feat/layer-11", { checks: [green] }),
    });
    expect(lines).toContain(
      "Blocked by a review or repo rule, not a check: #11",
    );
  });
});
