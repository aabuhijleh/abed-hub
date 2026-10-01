import { describe, expect, test } from "bun:test";
import { applyPatch, isPatched } from "./skills";

const UPSTREAM = `---
name: unslop
description: Cut AI tells from any writing. Must always apply.
disable-model-invocation: true
---

# Unslop

Edit text to remove AI patterns and add human voice.
`;

const PATCH = "Cut AI tells from PR bodies: and docs.";

const PATCHED = `---
name: unslop
description: "Cut AI tells from PR bodies: and docs."
---

# Unslop

Edit text to remove AI patterns and add human voice.
`;

describe("the unslop patch", () => {
  test("sees upstream's frontmatter as unpatched", () => {
    expect(isPatched(UPSTREAM, PATCH)).toBe(false);
  });

  test("switches invocation on, swaps the description, keeps the body", () => {
    expect(applyPatch(UPSTREAM, PATCH)).toBe(PATCHED);
    expect(isPatched(PATCHED, PATCH)).toBe(true);
  });

  test("is a no-op on a patched file", () => {
    expect(applyPatch(PATCHED, PATCH)).toBe(PATCHED);
  });

  test("catches a description upstream changed without the invocation key", () => {
    const reworded = PATCHED.replace(
      `"Cut AI tells from PR bodies: and docs."`,
      "Cut AI tells from any writing.",
    );
    expect(isPatched(reworded, PATCH)).toBe(false);
    expect(applyPatch(reworded, PATCH)).toBe(PATCHED);
  });

  test("replaces a folded description and all its lines", () => {
    const folded = UPSTREAM.replace(
      "description: Cut AI tells from any writing. Must always apply.",
      "description: >-\n  Cut AI tells from any writing.\n  Must always apply.",
    );
    expect(applyPatch(folded, PATCH)).toBe(PATCHED);
  });

  test("ignores the key outside the frontmatter", () => {
    const body = `${PATCHED}\ndisable-model-invocation: true\n`;
    expect(isPatched(body, PATCH)).toBe(true);
    expect(applyPatch(body, PATCH)).toBe(body);
  });

  test("leaves a file with no frontmatter untouched", () => {
    expect(applyPatch("# Unslop\n", PATCH)).toBe("# Unslop\n");
  });
});
