import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeJson } from "@abed-hub/config";
import { selected } from "./select";

let home: string;
const saved = process.env.XDG_CONFIG_HOME;

beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), "abed-hub-select-"));
  process.env.XDG_CONFIG_HOME = home;
});

afterEach(async () => {
  process.env.XDG_CONFIG_HOME = saved;
  await rm(home, { recursive: true, force: true });
});

describe("selected", () => {
  test("names what replaced a removed component", async () => {
    for (const name of ["prs", "writing-great-prs"]) {
      await expect(selected([name], false)).rejects.toThrow(
        `${name} was removed. Its parts are in gh-attach and unslop.`,
      );
    }
  });

  test("still rejects a name that never existed", async () => {
    await expect(selected(["gh-atach"], false)).rejects.toThrow(
      "unknown component: gh-atach",
    );
  });

  test("reads a saved removed component as what replaced it", async () => {
    await writeJson("abed-hub", "config.json", {
      components: ["writing-great-prs", "courier"],
    });
    expect(await selected([], false)).toEqual([
      "gh-attach",
      "unslop",
      "courier",
    ]);
  });
});
