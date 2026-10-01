import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeJson } from "@abed-hub/config";
import { checkTool } from "./tools";

let home: string;
const saved = process.env.XDG_CONFIG_HOME;

beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), "abed-hub-tools-"));
  process.env.XDG_CONFIG_HOME = home;
});

afterEach(async () => {
  process.env.XDG_CONFIG_HOME = saved;
  await rm(home, { recursive: true, force: true });
});

describe("courier credentials", () => {
  test("missing ones are a warning that hands over setup", async () => {
    const finding = await checkTool("jira-credentials");
    expect(finding.status).toBe("warning");
    expect(finding.fix).toMatchObject({ run: "manual", label: "jira setup" });
  });

  test("one section set leaves the other a warning", async () => {
    await writeJson("courier", "config.json", { jira: { token: "x" } });
    expect((await checkTool("jira-credentials")).status).toBe("ok");
    expect((await checkTool("slack-credentials")).status).toBe("warning");
  });
});
