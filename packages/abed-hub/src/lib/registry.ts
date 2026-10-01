export const COMPONENTS = [
  "gh-attach",
  "gh-stack",
  "unslop",
  "courier",
] as const;

export type Component = (typeof COMPONENTS)[number];

export type ToolId =
  | "bun"
  | "gh"
  | "gh-auth"
  | "gh-stack-ext"
  | "chromium"
  | "jira-credentials"
  | "slack-credentials";

export interface PackageDep {
  /** npm name, installed globally with bun. */
  pkg: string;
  /** A binary it provides, used to answer "is this already here". */
  bin: string;
}

export interface SkillDep {
  name: string;
  /** owner/repo on GitHub. */
  repo: string;
  /** The directory holding skill folders, which is not always `skills`. */
  dir: string;
  /** Swapped in for upstream's description when abed-hub patches the frontmatter. */
  patchedDescription?: string;
}

export interface ConfigDep {
  /** The directory the tool owns under the abed-hub config root. */
  tool: string;
  file: string;
  /** What it holds, since the key names alone do not always say. */
  summary: string;
  /** The commands that write it, printed when it is not there yet. */
  setup: string[];
}

export interface ComponentSpec {
  summary: string;
  packages: PackageDep[];
  skills: SkillDep[];
  tools: ToolId[];
  /** Config files the component reads. Absent when it needs none. */
  configs?: ConfigDep[];
}

const HUB = "aabuhijleh/abed-hub";

/** Checked alongside every component, since this is what installs them. */
export const SELF: PackageDep = {
  pkg: "@aabuhijleh/abed-hub",
  bin: "abed-hub",
};

/** Written by `setup`, read by everything else, so it shows with any selection. */
export const SELF_CONFIG: ConfigDep = {
  tool: "abed-hub",
  file: "config.json",
  summary: "the components setup last installed",
  setup: ["abed-hub setup"],
};

/** The skill that teaches an agent to run `doctor` when a tool goes missing. */
export const SELF_SKILL: SkillDep = {
  name: "abed-hub",
  repo: HUB,
  dir: "skills",
};

export const SPECS: Record<Component, ComponentSpec> = {
  "gh-attach": {
    summary: "Take an annotated screenshot and put it into a PR or issue",
    packages: [
      { pkg: "@aabuhijleh/gh-attach", bin: "gh-attach" },
      { pkg: "@playwright/cli", bin: "playwright-cli" },
    ],
    skills: [
      { name: "gh-attach", repo: HUB, dir: "skills" },
      { name: "screenshots", repo: HUB, dir: "skills" },
      {
        name: "playwright-cli",
        repo: "microsoft/playwright-cli",
        dir: "skills",
      },
      { name: "pr", repo: "mattpocock/skills", dir: "skills/engineering" },
    ],
    tools: ["gh", "gh-auth", "chromium"],
  },
  "gh-stack": {
    summary: "Break a change into PRs that build on each other",
    packages: [],
    skills: [{ name: "gh-stack", repo: HUB, dir: "skills" }],
    tools: ["gh", "gh-auth", "gh-stack-ext"],
  },
  unslop: {
    summary: "Cut AI tells from PR bodies, Slack and Jira posts, and docs",
    packages: [],
    skills: [
      {
        name: "unslop",
        repo: "cursor/plugins",
        dir: "pstack/skills",
        patchedDescription:
          "Cut AI tells from prose people read: PR titles and bodies, Slack and Jira posts, agent answers, READMEs and other human docs. Leave the fixed headings and bold labels of the `pr` skill and of PR templates as they are.",
      },
    ],
    tools: [],
  },
  courier: {
    summary: "Move files in and out of Jira issues and Slack threads",
    packages: [{ pkg: "@aabuhijleh/courier", bin: "jira" }],
    skills: [{ name: "courier", repo: HUB, dir: "skills" }],
    tools: ["jira-credentials", "slack-credentials"],
    configs: [
      {
        tool: "courier",
        file: "config.json",
        summary: "an Atlassian token and a Slack bot token, a section each",
        setup: ["jira setup", "slack setup"],
      },
    ],
  },
};

export function isComponent(value: string): value is Component {
  return (COMPONENTS as readonly string[]).includes(value);
}

/** Names that used to be components, and the ones that took over their parts. */
export const REMOVED: Record<string, Component[]> = {
  "writing-great-prs": ["gh-attach", "unslop"],
  prs: ["gh-attach", "unslop"],
};

export function removedMessage(name: string): string | null {
  const successors = REMOVED[name];
  if (!successors) return null;
  return `${name} was removed. Its parts are in ${successors.join(" and ")}.`;
}

/** The positional argument's help, shared by every command that takes one. */
export function componentsHelp(fallback: string): string {
  const bySuccessors = new Map<string, string[]>();
  for (const [name, successors] of Object.entries(REMOVED)) {
    const key = successors.join(" and ");
    bySuccessors.set(key, [...(bySuccessors.get(key) ?? []), name]);
  }
  const removed = [...bySuccessors].map(
    ([successors, names]) =>
      `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} gone: use ${successors}.`,
  );
  return [`all, or any of: ${COMPONENTS.join(", ")}.`, fallback, ...removed]
    .filter(Boolean)
    .join(" ");
}

/** `all` is what most people mean. */
export function resolveAlias(value: string): Component[] | null {
  if (value === "all") return [...COMPONENTS];
  return isComponent(value) ? [value] : null;
}

/** A selection in registry order, without duplicates. */
export function expand(selected: Iterable<Component>): Component[] {
  const wanted = new Set(selected);
  return COMPONENTS.filter((name) => wanted.has(name));
}
