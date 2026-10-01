import { describe, expect, test } from "bun:test";
import { lintSkill } from "./skills";

const FRONT = `name: courier
description: Reach Jira and Slack where the MCPs stop.
license: MIT
allowed-tools: Bash(jira:*)`;

const skill = (front = FRONT, body = "# courier\n") => ({
  dir: "courier",
  text: `---\n${front}\n---\n\n${body}`,
  files: ["SKILL.md"],
});

describe("lintSkill", () => {
  test("passes a well-formed skill", () => {
    expect(lintSkill(skill())).toEqual({ errors: [], warnings: [] });
  });

  test("fails a file with no frontmatter", () => {
    expect(
      lintSkill({ dir: "courier", text: "# courier\n", files: ["SKILL.md"] })
        .errors,
    ).toEqual(["frontmatter missing: the file must open and close with ---"]);
  });

  test("fails frontmatter YAML cannot parse", () => {
    const front = FRONT.replace(
      "where the MCPs stop.",
      "where the MCPs stop. Use for: attachments.",
    );
    expect(lintSkill(skill(front)).errors).toEqual([
      "frontmatter is not valid YAML, so the skill vanishes. Quote or fold the value with `: ` in it",
    ]);
  });

  test("fails an unquoted value YAML would cut at ` #`", () => {
    const front = FRONT.replace("stop.", "stop. See #12.");
    expect(lintSkill(skill(front)).errors).toEqual([
      "`description` holds ` #`, and YAML drops everything after it. Quote or fold the value",
    ]);
  });

  test("fails a name that is not the directory", () => {
    const front = FRONT.replace("name: courier", "name: postman");
    expect(lintSkill(skill(front)).errors).toEqual([
      "`name: postman` does not match the directory `courier`",
    ]);
  });

  test("fails a missing description, license, or allowed-tools", () => {
    expect(lintSkill(skill("name: courier")).errors).toEqual([
      "`description` is missing or empty",
      "`license` is missing",
      "`allowed-tools` is missing",
    ]);
  });

  test("warns near the description limit and fails past it", () => {
    const long = (n: number) =>
      FRONT.replace("Reach Jira and Slack where the MCPs stop.", "x".repeat(n));
    expect(lintSkill(skill(long(1300))).warnings).toEqual([
      "description is 1300 chars, near the 1536 limit",
    ]);
    expect(lintSkill(skill(long(1600))).errors).toEqual([
      "description is 1600 chars, over the 1536 limit",
    ]);
  });

  test("warns on a long body and fails a very long one", () => {
    expect(lintSkill(skill(FRONT, "line\n".repeat(300))).warnings).toEqual([
      "body is 301 lines. Past 250, move detail into a linked file",
    ]);
    expect(lintSkill(skill(FRONT, "line\n".repeat(600))).errors).toEqual([
      "body is 601 lines, over the 500 limit",
    ]);
  });

  test("fails a link to a file the skill does not ship", () => {
    const linked = skill(FRONT, "See [the ADF notes](jira-adf.md).\n");
    expect(lintSkill(linked).errors).toEqual([
      "links jira-adf.md, which this skill does not ship",
    ]);
    expect(
      lintSkill({ ...linked, files: ["SKILL.md", "jira-adf.md"] }).errors,
    ).toEqual([]);
  });

  test("fails a file the body never links", () => {
    expect(
      lintSkill({ ...skill(), files: ["SKILL.md", "references/old.md"] })
        .errors,
    ).toEqual(["references/old.md ships, but nothing links it"]);
  });
});
