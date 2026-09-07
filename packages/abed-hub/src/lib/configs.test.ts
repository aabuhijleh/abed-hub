import { describe, expect, test } from "bun:test";
import { configDeps, maskSecrets } from "./configs";

describe("maskSecrets", () => {
  test("masks a credential inside a section", () => {
    expect(
      maskSecrets({ slack: { SLACK_BOT_TOKEN: "xoxb-1234567890ABCD" } }),
    ).toEqual({
      value: { slack: { SLACK_BOT_TOKEN: "••••••••ABCD" } },
      masked: true,
    });
  });

  test("leaves everything that is not a credential alone", () => {
    const config = {
      jira: {
        ATLASSIAN_BASE_URL: "https://acme.atlassian.net",
        ATLASSIAN_USER_EMAIL: "ada@acme.com",
      },
      components: ["gh-attach", "courier"],
    };
    expect(maskSecrets(config)).toEqual({ value: config, masked: false });
  });

  test("catches a new credential by its name, wherever it sits", () => {
    const { value, masked } = maskSecrets({
      accounts: [{ apiKey: "abcdef123456" }],
    });
    expect(value).toEqual({ accounts: [{ apiKey: "••••••••3456" }] });
    expect(masked).toBe(true);
  });
});

describe("configDeps", () => {
  test("lists abed-hub's own file for a component with no config", () => {
    expect(configDeps(["gh-attach"]).map((dep) => dep.tool)).toEqual([
      "abed-hub",
    ]);
  });

  test("adds a component's file after it", () => {
    expect(configDeps(["courier"]).map((dep) => dep.tool)).toEqual([
      "abed-hub",
      "courier",
    ]);
  });

  test("names a file once however many components read it", () => {
    expect(configDeps(["courier", "courier"]).length).toBe(2);
  });
});
