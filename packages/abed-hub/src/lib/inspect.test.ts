import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { patchLabel, repairPatches } from "./inspect";
import { SPECS } from "./registry";

const UPSTREAM = `---
name: unslop
description: Cut AI tells from any writing.
disable-model-invocation: true
---

# Unslop
`;

let store: string;
const unslop = () => path.join(store, "unslop", "SKILL.md");

beforeEach(async () => {
  store = await mkdtemp(path.join(tmpdir(), "abed-hub-store-"));
});

afterEach(async () => {
  await rm(store, { recursive: true, force: true });
});

describe("repairPatches", () => {
  test("re-patches a skill that update overwrote", async () => {
    await Bun.write(unslop(), UPSTREAM);

    expect(await repairPatches(["unslop"], store)).toEqual(["unslop"]);

    const text = await Bun.file(unslop()).text();
    expect(text).not.toContain("disable-model-invocation");
    expect(text).toContain(
      JSON.stringify(SPECS.unslop.skills[0]?.patchedDescription),
    );
  });

  test("leaves a patched skill alone", async () => {
    await Bun.write(unslop(), UPSTREAM);
    await repairPatches(["unslop"], store);

    expect(await repairPatches(["unslop"], store)).toEqual([]);
  });

  test("skips a skill that is not installed", async () => {
    expect(await repairPatches(["unslop"], store)).toEqual([]);
  });

  test("only looks at the selected components", async () => {
    await Bun.write(unslop(), UPSTREAM);

    expect(await repairPatches(["courier"], store)).toEqual([]);
    expect(await Bun.file(unslop()).text()).toBe(UPSTREAM);
  });
});

describe("patchLabel", () => {
  test("names the skill whose frontmatter is patched", () => {
    expect(patchLabel("unslop")).toBe("patch unslop's frontmatter");
  });
});
