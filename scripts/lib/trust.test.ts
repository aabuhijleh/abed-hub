import { describe, expect, test } from "bun:test";
import { explainStageFailure, stagedFromCiBefore } from "./trust";

describe("stagedFromCiBefore", () => {
  test("a package published only by hand has not", () => {
    expect(stagedFromCiBefore({ versions: { "0.1.0": { dist: {} } } })).toBe(
      false,
    );
  });

  test("one attested version is enough", () => {
    expect(
      stagedFromCiBefore({
        versions: {
          "0.1.0": { dist: {} },
          "0.2.0": { dist: { attestations: { provenance: {} } } },
        },
      }),
    ).toBe(true);
  });

  test("an empty packument has not", () => {
    expect(stagedFromCiBefore({})).toBe(false);
  });
});

describe("explainStageFailure", () => {
  const e401 =
    "npm error code E401\nnpm error Unable to authenticate, your authentication token seems to be invalid.";

  test("names the settings page and the rerun for an auth failure", () => {
    const hint = explainStageFailure(e401, "@a/courier", "123");

    expect(hint).toContain("https://www.npmjs.com/package/@a/courier/access");
    expect(hint).toContain("workflow release.yml");
    expect(hint).toContain("gh run rerun 123");
  });

  test("leaves the rerun out without a run id", () => {
    expect(explainStageFailure(e401, "@a/courier")).not.toContain("rerun");
  });

  test("keeps quiet on any other failure", () => {
    expect(
      explainStageFailure("npm error code E403\nforbidden", "@a/courier"),
    ).toBeNull();
  });
});
