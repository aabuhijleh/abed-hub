type AdfNode = {
  type?: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
};

/** Convert Atlassian Document Format (ADF) to plain text. */
export function adfToText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node !== "object") return "";

  const n = node as AdfNode;

  if (n.type === "text") return n.text ?? "";
  if (n.type === "hardBreak") return "\n";
  if (n.type === "mention") {
    const text = n.attrs?.text;
    return typeof text === "string" ? text : "";
  }
  if (n.type === "emoji") {
    const shortName = n.attrs?.shortName;
    return typeof shortName === "string" ? shortName : "";
  }
  if (
    n.type === "inlineCard" ||
    n.type === "blockCard" ||
    n.type === "embedCard"
  ) {
    const url = n.attrs?.url;
    return typeof url === "string" ? url : "";
  }

  const children = (n.content ?? []).map(adfToText).join("");

  switch (n.type) {
    case "paragraph":
    case "heading":
    case "blockquote":
    case "codeBlock":
    case "rule":
      return `${children}\n`;
    case "listItem":
      return `- ${children.trim()}\n`;
    case "bulletList":
    case "orderedList":
      return `${children}\n`;
    default:
      return children;
  }
}
