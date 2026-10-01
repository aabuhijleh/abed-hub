import {
  parseFrontmatter,
  splitFrontmatter,
} from "../../packages/abed-hub/src/lib/frontmatter";

/** The authoring rules for `skills/<name>/SKILL.md`; bad YAML silently hides a skill. */
const DESCRIPTION_LIMIT = 1536;
const DESCRIPTION_WARN = 1200;
const BODY_LIMIT = 500;
const BODY_WARN = 250;
const REQUIRED = ["license", "allowed-tools"];

export interface SkillFiles {
  /** The skill's directory name, which `name` must equal. */
  dir: string;
  /** SKILL.md as it sits on disk. */
  text: string;
  /** Every file in the directory, relative to it. */
  files: string[];
}

export interface Lint {
  errors: string[];
  warnings: string[];
}

const PLAIN_VALUE = /^([A-Za-z_-][\w-]*):\s+([^\s"'>|[{].*)$/;
const LOCAL_LINK = /\]\((?!https?:|#|mailto:)([^)\s#]+\.md)(?:#[^)]*)?\)/g;

export function lintSkill({ dir, text, files }: SkillFiles): Lint {
  const errors: string[] = [];
  const warnings: string[] = [];

  const split = splitFrontmatter(text);
  if (!split) {
    errors.push("frontmatter missing: the file must open and close with ---");
    return { errors, warnings };
  }
  const { front, body } = split;

  const fields = parseFrontmatter(front);
  if (!fields) {
    errors.push(
      "frontmatter is not valid YAML, so the skill vanishes. Quote or fold the value with `: ` in it",
    );
    return { errors, warnings };
  }

  for (const line of front.split("\n")) {
    const [, key, value] = PLAIN_VALUE.exec(line) ?? [];
    if (key && value?.includes(" #")) {
      errors.push(
        `\`${key}\` holds \` #\`, and YAML drops everything after it. Quote or fold the value`,
      );
    }
  }

  const name = fields.name;
  if (typeof name !== "string" || name === "") {
    errors.push("`name` is missing or empty");
  } else if (name !== dir) {
    errors.push(`\`name: ${name}\` does not match the directory \`${dir}\``);
  }

  const description = fields.description;
  if (typeof description !== "string" || description.trim() === "") {
    errors.push("`description` is missing or empty");
  } else {
    const whenToUse =
      typeof fields.when_to_use === "string" ? fields.when_to_use : "";
    const length = description.length + whenToUse.length;
    if (length > DESCRIPTION_LIMIT) {
      errors.push(
        `description is ${length} chars, over the ${DESCRIPTION_LIMIT} limit`,
      );
    } else if (length > DESCRIPTION_WARN) {
      warnings.push(
        `description is ${length} chars, near the ${DESCRIPTION_LIMIT} limit`,
      );
    }
  }

  for (const key of REQUIRED) {
    if (fields[key] == null || fields[key] === "") {
      errors.push(`\`${key}\` is missing`);
    }
  }

  const lines = body.split("\n").length - 1;
  if (lines > BODY_LIMIT) {
    errors.push(`body is ${lines} lines, over the ${BODY_LIMIT} limit`);
  } else if (lines > BODY_WARN) {
    warnings.push(
      `body is ${lines} lines. Past ${BODY_WARN}, move detail into a linked file`,
    );
  }

  const shipped = new Set(files);
  const linked = new Set(
    [...body.matchAll(LOCAL_LINK)].map(([, link = ""]) =>
      link.replace(/^\.\//, ""),
    ),
  );
  for (const link of linked) {
    if (!shipped.has(link))
      errors.push(`links ${link}, which this skill does not ship`);
  }
  for (const file of files) {
    if (file.endsWith(".md") && file !== "SKILL.md" && !linked.has(file)) {
      errors.push(`${file} ships, but nothing links it`);
    }
  }

  return { errors, warnings };
}
