import { describe, expect, test } from "bun:test";
import { hasDisableKey, stripDisableKey } from "./skills";

const UPSTREAM = `---
name: unslop
description: Cut AI tells from any writing. Must always apply.
disable-model-invocation: true
---

# Unslop

Edit text to remove AI patterns and add human voice.
`;

describe("the unslop patch", () => {
  test("finds the key upstream ships", () => {
    expect(hasDisableKey(UPSTREAM)).toBe(true);
  });

  test("strips it and leaves the rest of the file alone", () => {
    const patched = stripDisableKey(UPSTREAM);
    expect(hasDisableKey(patched)).toBe(false);
    expect(patched).toBe(
      UPSTREAM.replace("disable-model-invocation: true\n", ""),
    );
  });

  test("is a no-op on a file that never had it", () => {
    const clean = stripDisableKey(UPSTREAM);
    expect(stripDisableKey(clean)).toBe(clean);
  });

  test("ignores the key outside the frontmatter", () => {
    const body = `---\nname: unslop\n---\n\ndisable-model-invocation: true\n`;
    expect(hasDisableKey(body)).toBe(false);
    expect(stripDisableKey(body)).toBe(body);
  });

  test("leaves a file with no frontmatter untouched", () => {
    expect(hasDisableKey("# Unslop\n")).toBe(false);
    expect(stripDisableKey("# Unslop\n")).toBe("# Unslop\n");
  });
});
