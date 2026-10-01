import { describe, expect, test } from "bun:test";
import { applyFixes } from "./apply";
import { type Finding, needsWork } from "./finding";

const warning = (fix: Finding["fix"]): Finding => ({
  kind: "tool",
  name: "slack credentials",
  status: "warning",
  detail: "not configured",
  fix,
});

describe("a warning", () => {
  test("is never work, not even for update", () => {
    expect(needsWork(warning(undefined), true)).toBe(false);
  });

  test("is listed for the user to run, not run", async () => {
    const result = await applyFixes(
      [
        warning({ run: "manual", label: "slack setup" }),
        warning({ run: "command", argv: ["false"], label: "run false" }),
      ],
      [],
      { upgrade: true },
    );
    expect(result.manual).toEqual(["slack setup"]);
    expect(result.done).toEqual([]);
    expect(result.failed).toEqual([]);
  });
});
