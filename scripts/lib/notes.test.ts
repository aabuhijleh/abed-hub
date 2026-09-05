import { describe, expect, test } from "bun:test";
import { notesBody, previousTag, releaseTag, shortName } from "./notes";

describe("releaseTag", () => {
  test("drops the shared scope but keeps the name", () => {
    expect(releaseTag("@aabuhijleh/gh-attach", "0.2.0")).toBe(
      "gh-attach@0.2.0",
    );
    expect(shortName("unscoped")).toBe("unscoped");
  });
});

describe("previousTag", () => {
  const tags = [
    "courier@0.1.0",
    "gh-attach@0.1.0",
    "gh-attach@0.2.0",
    "gh-attach@0.10.0",
  ];

  test("picks this package's newest tag below the version being cut", () => {
    expect(previousTag(tags, "@aabuhijleh/gh-attach", "0.11.0")).toBe(
      "gh-attach@0.10.0",
    );
  });

  test("orders by semver, not by string", () => {
    expect(previousTag(tags, "@aabuhijleh/gh-attach", "0.3.0")).toBe(
      "gh-attach@0.2.0",
    );
  });

  test("ignores tags belonging to another package", () => {
    expect(previousTag(tags, "@aabuhijleh/courier", "0.2.0")).toBe(
      "courier@0.1.0",
    );
  });

  test("is null on a package's first release", () => {
    expect(previousTag(tags, "@aabuhijleh/abed-hub", "0.1.0")).toBeNull();
  });
});

describe("notesBody", () => {
  const base = {
    pkg: "@aabuhijleh/gh-attach",
    dir: "packages/gh-attach",
    version: "0.2.0",
    previous: "gh-attach@0.1.0",
  };

  test("names the range and links the exact version on npm", () => {
    const body = notesBody({ ...base, commits: ["- a1b2c3d fix: a thing"] });

    expect(body).toContain("since gh-attach@0.1.0");
    expect(body).toContain("- a1b2c3d fix: a thing");
    expect(body).toContain(
      "https://www.npmjs.com/package/@aabuhijleh/gh-attach/v/0.2.0",
    );
  });

  test("says so rather than leaving a blank section", () => {
    const body = notesBody({ ...base, commits: [] });

    expect(body).toContain("Nothing under `packages/gh-attach` changed");
  });
});
