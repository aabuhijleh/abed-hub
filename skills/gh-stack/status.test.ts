import { describe, expect, test } from "bun:test";
import path from "node:path";

const filter = path.join(import.meta.dir, "status.jq");

interface Check {
  name: string;
  conclusion: string;
  isRequired: boolean;
  startedAt?: string;
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

function report(prs: object, tracked = true, files: object = {}): string[] {
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
    "files",
    JSON.stringify(files),
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

const row = (lines: string[], pr: number) =>
  lines.find((l) => /\d\/\d/.test(l) && l.includes(`#${pr} `)) ?? "";

describe("status report", () => {
  test("counts the PRs and places each one, marking the target", () => {
    const lines = report({ ...pr(11, "main"), ...pr(12, "feat/layer-11") });
    expect(lines[0]).toBe("📚 Stack #7: 3 PRs onto main, bottom to top");
    expect(lines[1]).toBe("👉 #12 is 3 of 3");
    expect(row(lines, 10)).toMatch(/^ +1\/3 +#10 +a +🔀 merged$/);
    expect(row(lines, 12)).toMatch(/^👉 +3\/3 +#12 +c /);
  });

  test("a current stack says so and suggests nothing", () => {
    const lines = report({
      ...pr(11, "main", { checks: [green] }),
      ...pr(12, "feat/layer-11", { checks: [green] }),
    });
    expect(lines).toContain("✅ Up to date with main");
    expect(lines).toContain("✅ Up to date with each base");
    expect(lines).toContain("✅ No conflicts");
    expect(lines).toContain("✅ Every check passing on every open PR");
    expect(lines).toContain("✨ Nothing to update.");
  });

  test("names each stale PR and suggests the sync", () => {
    const lines = report(
      {
        ...pr(11, "main", { behindTrunk: 3 }),
        ...pr(12, "feat/layer-11", { behindBase: 2, behindTrunk: 3 }),
      },
      false,
    );
    expect(row(lines, 12)).toContain("❌ 3 behind  ❌ 2 behind");
    expect(lines).toContain("❌ Behind main: #11 by 3, #12 by 3");
    expect(lines).toContain("❌ Behind its base: #12 by 2");
    expect(lines).toContain(
      "💡 Suggested update: gh stack checkout 7, then gh stack sync, which rebases each layer onto the one below and pushes. Rerun this report after.",
    );
  });

  test("lists each conflict's files and how to resolve it", () => {
    const lines = report(
      {
        ...pr(11, "main", { behindTrunk: 2 }),
        ...pr(12, "feat/layer-11", { merge: "DIRTY" }),
      },
      true,
      {
        "11": { base: [], trunk: ["src/api.ts"] },
        "12": { base: ["src/a.ts", "src/b.ts"], trunk: [] },
      },
    );
    expect(row(lines, 11)).toContain("💥 2 behind");
    expect(row(lines, 12)).toMatch(/✅ +💥 +.*💥 conflicts$/);
    expect(lines).toContain("💥 Conflicts:");
    expect(lines).toContain(
      "     #12 with its base feat/layer-11: src/a.ts, src/b.ts",
    );
    expect(lines).toContain("     #11 with main once synced: src/api.ts");
    expect(lines.at(-2)).toStartWith(
      "💡 Suggested update: gh stack sync. It stops on the conflict;",
    );
  });

  test("lists failing checks, required apart from optional", () => {
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
    expect(row(lines, 11)).toContain("❌ 1 required failing");
    expect(row(lines, 12)).toContain("🟡 1 optional failing");
    expect(lines).toContain("❌ Required checks failing (blocks merge):");
    expect(lines).toContain("     #11: Test");
    expect(lines).toContain("🟡 Optional checks failing (merge not blocked):");
    expect(lines).toContain("     #12: Lint");
  });

  test("counts only the latest run of a check, as GitHub does", () => {
    const lines = report({
      ...pr(11, "main", {
        checks: [
          {
            name: "Lint",
            conclusion: "CANCELLED",
            isRequired: false,
            startedAt: "2026-01-01T09:00:00Z",
          },
          {
            name: "Lint",
            conclusion: "SUCCESS",
            isRequired: false,
            startedAt: "2026-01-01T10:00:00Z",
          },
          green,
        ],
      }),
      ...pr(12, "feat/layer-11", { checks: [green] }),
    });
    expect(row(lines, 11)).toContain("✅ 2 passed");
    expect(lines).toContain("✅ Every check passing on every open PR");
  });

  test("blocked with green checks points at a review or rule", () => {
    const lines = report({
      ...pr(11, "main", { merge: "BLOCKED", checks: [green] }),
      ...pr(12, "feat/layer-11", { checks: [green] }),
    });
    expect(row(lines, 11)).toContain("🔒 review or rule");
    expect(lines).toContain("🔒 Waiting on a review or repo rule: #11");
  });
});
