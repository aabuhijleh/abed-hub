import { describe, expect, test } from "bun:test";
import {
  COMPONENTS,
  componentsHelp,
  expand,
  REMOVED,
  resolveAlias,
  SPECS,
} from "./registry";

describe("resolveAlias", () => {
  test("all is every component", () => {
    expect(resolveAlias("all")).toEqual([...COMPONENTS]);
  });

  test("a removed name is nothing", () => {
    expect(resolveAlias("prs")).toBeNull();
    expect(resolveAlias("writing-great-prs")).toBeNull();
    expect(resolveAlias("unslop")).toBeNull();
  });

  test("a real name is itself", () => {
    expect(resolveAlias("courier")).toEqual(["courier"]);
  });

  test("anything else is nothing", () => {
    expect(resolveAlias("gh-atach")).toBeNull();
  });
});

describe("expand", () => {
  test("keeps registry order, not the order asked for", () => {
    expect(expand(["courier", "gh-attach"])).toEqual(["gh-attach", "courier"]);
  });

  test("does not repeat a component asked for twice", () => {
    expect(expand(["courier", "courier"])).toEqual(["courier"]);
  });
});

describe("deslop", () => {
  test("is a component of its own", () => {
    expect(COMPONENTS).toContain("deslop");
    expect(COMPONENTS).not.toContain("unslop");
  });

  test("installs abed-hub's own skill", () => {
    expect(SPECS.deslop.skills).toEqual([
      { name: "deslop", repo: "aabuhijleh/abed-hub", dir: "skills" },
    ]);
  });

  test("takes over unslop and the parts of writing-great-prs", () => {
    expect(REMOVED.unslop).toEqual(["deslop"]);
    expect(REMOVED["writing-great-prs"]).toEqual(["gh-attach", "deslop"]);
    expect(REMOVED.prs).toEqual(["gh-attach", "deslop"]);
  });
});

describe("gh-attach", () => {
  const spec = SPECS["gh-attach"];

  test("installs the browser that shot renders with", () => {
    expect(spec.packages.map((dep) => dep.pkg)).toContain("@playwright/cli");
    expect(spec.tools).toContain("chromium");
  });

  test("installs the skills that take a shot and drive a page", () => {
    expect(spec.skills.map((dep) => dep.name)).toEqual(
      expect.arrayContaining(["gh-attach", "screenshots", "playwright-cli"]),
    );
  });

  test("installs the pr skill that screenshots and gh-stack defer to", () => {
    expect(spec.skills).toContainEqual({
      name: "pr",
      repo: "mattpocock/skills",
      dir: "skills/engineering",
    });
  });
});

describe("every component", () => {
  const selected = expand(COMPONENTS);

  test("installs each package once", () => {
    const pkgs = selected.flatMap((name) =>
      SPECS[name].packages.map((dep) => dep.pkg),
    );
    expect(pkgs).toEqual([...new Set(pkgs)]);
  });

  test("installs each skill once", () => {
    const skills = selected.flatMap((name) =>
      SPECS[name].skills.map((dep) => dep.name),
    );
    expect(skills).toEqual([...new Set(skills)]);
  });
});

describe("componentsHelp", () => {
  test("lists the components and the fallback", () => {
    expect(componentsHelp("Defaults to setup.")).toStartWith(
      `all, or any of: ${COMPONENTS.join(", ")}. Defaults to setup.`,
    );
  });

  test("names every removed component and what replaced it", () => {
    const help = componentsHelp("");
    for (const [name, successors] of Object.entries(REMOVED)) {
      expect(help).toContain(name);
      for (const successor of successors) expect(help).toContain(successor);
    }
  });
});
