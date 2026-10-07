import { describe, expect, test } from "bun:test";
import {
  bodyMatches,
  type Fork,
  patchedBody,
  pinnedCommit,
  rebuild,
  repin,
} from "./forks";

const fork: Fork = {
  skill: "deslop",
  repo: "owner/repo",
  path: "skills/unslop/SKILL.md",
  patches: [{ find: "\n# Unslop\n", replace: "\n# Deslop\n" }],
};

const upstream = `---
name: unslop
description: Upstream's own.
---

# Unslop

Rule one.
`;

const local = `---
name: deslop
description: Ours.
---

# Deslop

Rule one.
`;

describe("rebuild", () => {
  test("keeps our frontmatter and takes upstream's patched body", () => {
    const moved = upstream.replace("Rule one.", "Rule one.\nRule two.");
    expect(rebuild(fork, local, moved)).toBe(
      local.replace("Rule one.", "Rule one.\nRule two."),
    );
  });

  test("leaves a fork already in step unchanged", () => {
    expect(rebuild(fork, local, upstream)).toBe(local);
  });
});

describe("patchedBody", () => {
  test("refuses a patch that no longer matches upstream", () => {
    const renamed = upstream.replace("# Unslop", "# Unslop prose");
    expect(() => patchedBody(fork, renamed)).toThrow("matches 0 times");
  });

  test("refuses a patch that matches more than once", () => {
    const twice = `${upstream}\n# Unslop\n`;
    expect(() => patchedBody(fork, twice)).toThrow("matches 2 times");
  });
});

describe("bodyMatches", () => {
  test("accepts a body that is upstream plus the patches", () => {
    expect(bodyMatches(fork, local, upstream)).toBe(true);
  });

  test("catches an edit made outside a patch", () => {
    const edited = local.replace("Rule one.", "Rule one, edited.");
    expect(bodyMatches(fork, edited, upstream)).toBe(false);
  });
});

describe("pinnedCommit and repin", () => {
  const old = "a".repeat(40);
  const next = "b".repeat(40);
  const credits = `taken at commit
[\`aaaaaaa\`](https://github.com/owner/repo/blob/${old}/skills/unslop/SKILL.md).
`;

  test("reads the full sha from the pinned link", () => {
    expect(pinnedCommit(credits)).toBe(old);
  });

  test("moves the short and full sha together", () => {
    expect(repin(credits, next)).toBe(`taken at commit
[\`bbbbbbb\`](https://github.com/owner/repo/blob/${next}/skills/unslop/SKILL.md).
`);
  });

  test("refuses credits without a pinned link", () => {
    expect(() => pinnedCommit("no link")).toThrow("full commit sha");
  });
});
