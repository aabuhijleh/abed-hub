import { describe, expect, test } from "bun:test";
import { age, fromAutomation, parseStaged } from "./staged";

const entry = {
  id: "3944127f-8114-4546-b7bc-696870599dcf",
  packageName: "@aabuhijleh/gh-attach",
  version: "0.2.0",
  tag: "latest",
  createdAt: "2026-09-05T11:47:26.601Z",
  actor: "GitHub Actions",
  actorType: "trusted automation",
  access: "public",
  shasum: "0ffb1af892e50102ef87f996344107cbd59d9beb",
  status: "staged",
};

describe("parseStaged", () => {
  test("reads what npm stage list --json actually returns", () => {
    const [parsed] = parseStaged(JSON.stringify([entry]));

    expect(parsed?.packageName).toBe("@aabuhijleh/gh-attach");
    expect(parsed?.version).toBe("0.2.0");
    expect(parsed?.id).toBe(entry.id);
  });

  test("throws rather than half-reading an entry missing a field", () => {
    const { shasum, ...missing } = entry;

    expect(() => parseStaged(JSON.stringify([missing]))).toThrow("no shasum");
  });

  test("throws when npm returns something that is not a list", () => {
    expect(() => parseStaged('{"error":"nope"}')).toThrow(
      "did not return a list",
    );
  });
});

describe("fromAutomation", () => {
  test("tells CI apart from a person with a laptop", () => {
    expect(fromAutomation(entry)).toBe(true);
    expect(fromAutomation({ ...entry, actorType: "user" })).toBe(false);
  });
});

describe("age", () => {
  const now = new Date("2026-09-05T12:00:00.000Z");

  test("scales from seconds to days", () => {
    expect(age("2026-09-05T12:00:00.000Z", now)).toBe("just now");
    expect(age("2026-09-05T11:47:00.000Z", now)).toBe("13 minutes ago");
    expect(age("2026-09-05T09:00:00.000Z", now)).toBe("3 hours ago");
    expect(age("2026-09-02T12:00:00.000Z", now)).toBe("3 days ago");
  });

  test("says one minute, not 1 minutes", () => {
    expect(age("2026-09-05T11:59:00.000Z", now)).toBe("1 minute ago");
  });
});
