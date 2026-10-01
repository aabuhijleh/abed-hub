const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;

/** A SKILL.md split at its frontmatter fences, or null when it has none. */
export function splitFrontmatter(
  text: string,
): { front: string; body: string } | null {
  const match = FRONTMATTER.exec(text);
  if (!match) return null;
  return { front: match[1] ?? "", body: match[2] ?? "" };
}

/** The frontmatter as a YAML mapping, or null when it is not one. */
export function parseFrontmatter(
  front: string,
): Record<string, unknown> | null {
  try {
    const value = Bun.YAML.parse(front);
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
