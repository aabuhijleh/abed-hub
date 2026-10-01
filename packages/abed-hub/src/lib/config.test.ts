import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeFile, writeJson } from "@abed-hub/config";
import { readSelection, writeSelection } from "./config";

let home: string;
const saved = process.env.XDG_CONFIG_HOME;

beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), "abed-hub-config-"));
  process.env.XDG_CONFIG_HOME = home;
});

afterEach(async () => {
  process.env.XDG_CONFIG_HOME = saved;
  await rm(home, { recursive: true, force: true });
});

describe("readSelection", () => {
  test("is null before setup has run", async () => {
    expect(await readSelection()).toBeNull();
  });

  test("reads back what setup wrote", async () => {
    await writeSelection(["gh-stack", "courier"]);
    expect(await readSelection()).toEqual(["gh-stack", "courier"]);
  });

  test("is null for a file that is not a selection", async () => {
    await writeJson("abed-hub", "config.json", { components: "courier" });
    expect(await readSelection()).toBeNull();
  });

  test("drops names it does not know and expands removed ones", async () => {
    await writeJson("abed-hub", "config.json", {
      components: ["prs", "gh-atach", "courier"],
    });
    expect(await readSelection()).toEqual(["gh-attach", "deslop", "courier"]);
  });

  test("reads a saved unslop as deslop", async () => {
    await writeJson("abed-hub", "config.json", {
      components: ["unslop", "courier"],
    });
    expect(await readSelection()).toEqual(["deslop", "courier"]);
  });

  test("is null for a file that is not JSON", async () => {
    await writeFile("abed-hub", "config.json", "{");
    expect(await readSelection()).toBeNull();
  });
});
