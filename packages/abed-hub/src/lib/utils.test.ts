import { describe, expect, test } from "bun:test";
import { compareVersions } from "./utils";

describe("compareVersions", () => {
  test("orders by each numeric segment", () => {
    expect(compareVersions("0.1.0", "0.2.0")).toBe(-1);
    expect(compareVersions("0.2.0", "0.1.0")).toBe(1);
    expect(compareVersions("0.2.0", "0.2.0")).toBe(0);
    expect(compareVersions("2.9.0", "2.10.0")).toBe(-1);
    expect(compareVersions("2.100.0", "2.99.0")).toBe(1);
  });

  test("ignores a leading v, which is how gh tags releases", () => {
    expect(compareVersions("v0.1.1", "v0.2.0")).toBe(-1);
    expect(compareVersions("v0.1.1", "0.1.1")).toBe(0);
  });

  test("treats a missing segment as zero", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1.2", "1.2.1")).toBe(-1);
  });
});
