import { describe, expect, test } from "bun:test";
import { renderedExpression } from "./shot";

function settle(rendered: unknown, timeoutMs = 50): Promise<string | null> {
  const run = new Function("window", `return ${renderedExpression(timeoutMs)}`);
  return run({ rendered });
}

describe("renderedExpression", () => {
  test("passes at once when the page sets nothing", async () => {
    expect(await settle(undefined)).toBeNull();
  });

  test("waits for the page's promise", async () => {
    let done = false;
    const rendered = new Promise((ok) =>
      setTimeout(() => {
        done = true;
        ok(undefined);
      }, 20),
    );
    expect(await settle(rendered)).toBeNull();
    expect(done).toBe(true);
  });

  test("reports a render that fails", async () => {
    expect(await settle(Promise.reject(new Error("bad spec")))).toBe(
      "bad spec",
    );
  });

  test("reports a render that never settles", async () => {
    expect(await settle(new Promise(() => {}), 30)).toBe(
      "window.rendered did not settle in 0.03 s",
    );
  });
});
