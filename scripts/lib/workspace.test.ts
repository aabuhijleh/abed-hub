import { describe, expect, test } from "bun:test";
import {
  bumpVersion,
  planReleases,
  publishablePackages,
  type WorkspacePackage,
} from "./workspace";

const pkg = (name: string, version: string): WorkspacePackage => ({
  name,
  dir: `packages/${name.split("/")[1]}`,
  version,
});

describe("planReleases", () => {
  test("releases only what the tree moved ahead of npm", () => {
    const plan = planReleases(
      [pkg("@a/one", "0.2.0"), pkg("@a/two", "0.1.0")],
      new Map([
        ["@a/one", "0.1.0"],
        ["@a/two", "0.1.0"],
      ]),
    );

    expect(plan.map((entry) => entry.verdict)).toEqual(["release", "current"]);
  });

  test("refuses to stage a package npm has never seen", () => {
    const [entry] = planReleases([pkg("@a/new", "0.1.0")], new Map());

    expect(entry?.verdict).toBe("unpublished");
    expect(entry?.published).toBeNull();
  });

  test("flags a package npm is ahead of, rather than downgrading it", () => {
    const [entry] = planReleases(
      [pkg("@a/one", "0.1.0")],
      new Map([["@a/one", "0.2.0"]]),
    );

    expect(entry?.verdict).toBe("ahead");
  });
});

describe("bumpVersion", () => {
  test("zeroes everything below the part it raises", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
  });

  test("rejects anything that is not semver", () => {
    expect(() => bumpVersion("latest", "patch")).toThrow("not a semver");
  });
});

describe("publishablePackages", () => {
  test("skips @abed-hub/config, which is private and gets inlined", async () => {
    const names = (await publishablePackages(`${import.meta.dir}/../..`)).map(
      (entry) => entry.name,
    );

    expect(names).toContain("@aabuhijleh/gh-attach");
    expect(names).not.toContain("@abed-hub/config");
  });
});
