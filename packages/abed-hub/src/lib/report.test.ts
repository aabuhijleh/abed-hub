import { describe, expect, test } from "bun:test";
import type { Finding, Status } from "./finding";
import { doctorOutcome, summarize } from "./report";

const finding = (status: Status): Finding => ({
  kind: "tool",
  name: status,
  status,
  detail: "",
});

describe("summarize", () => {
  test("is empty when only warnings are left", () => {
    expect(summarize([finding("ok"), finding("warning")])).toBe("");
  });

  test("counts what needs work", () => {
    expect(
      summarize([finding("stale"), finding("missing"), finding("warning")]),
    ).toBe("1 behind, 1 missing");
  });
});

describe("doctorOutcome", () => {
  test("passes with only warnings left, and says so", () => {
    const outcome = doctorOutcome([finding("ok"), finding("warning")]);
    expect(outcome.failed).toBe(false);
    expect(outcome.message).toBe(
      "Everything is here and up to date. 1 warning for tools you may not use.",
    );
  });

  test("passes quietly when everything is fine", () => {
    expect(doctorOutcome([finding("ok")])).toEqual({
      failed: false,
      message: "Everything is here and up to date.",
    });
  });

  test("fails and points at setup when something is missing", () => {
    expect(doctorOutcome([finding("stale"), finding("missing")])).toEqual({
      failed: true,
      message: "1 behind, 1 missing. abed-hub setup fixes what it can.",
    });
  });

  test("fails and points at update when something is behind or broken", () => {
    expect(doctorOutcome([finding("broken"), finding("warning")])).toEqual({
      failed: true,
      message: "1 needing repair. abed-hub update fixes what it can.",
    });
  });
});
