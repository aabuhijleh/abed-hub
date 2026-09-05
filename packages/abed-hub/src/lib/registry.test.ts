import { describe, expect, test } from "bun:test";
import { COMPONENTS, expand, resolveAlias } from "./registry";

describe("resolveAlias", () => {
  test("all is every component", () => {
    expect(resolveAlias("all")).toEqual([...COMPONENTS]);
  });

  test("prs is the long name", () => {
    expect(resolveAlias("prs")).toEqual(["writing-great-prs"]);
  });

  test("a real name is itself", () => {
    expect(resolveAlias("courier")).toEqual(["courier"]);
  });

  test("anything else is nothing", () => {
    expect(resolveAlias("gh-atach")).toBeNull();
  });
});

describe("expand", () => {
  test("pulls in what a component needs", () => {
    expect(expand(["writing-great-prs"])).toEqual([
      "gh-attach",
      "writing-great-prs",
    ]);
  });

  test("keeps registry order, not the order asked for", () => {
    expect(expand(["courier", "gh-attach"])).toEqual(["gh-attach", "courier"]);
  });

  test("does not repeat a component reached twice", () => {
    expect(expand(["gh-attach", "writing-great-prs"])).toEqual([
      "gh-attach",
      "writing-great-prs",
    ]);
  });
});
