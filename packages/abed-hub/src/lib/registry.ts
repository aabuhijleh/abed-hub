export const COMPONENTS = [
  "gh-attach",
  "gh-stack",
  "writing-great-prs",
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
  /**
   * Upstream ships this one user-invoked, which stops the abed-hub skills from
   * reaching it. Setup strips the key and doctor checks it stayed stripped.
   */
  patchInvocation?: boolean;
}

export interface ComponentSpec {
  summary: string;
  packages: PackageDep[];
  skills: SkillDep[];
  tools: ToolId[];
  /** Components pulled in with this one. */
  needs?: Component[];
}

const HUB = "aabuhijleh/abed-hub";

/** Checked alongside every component, since this is what installs them. */
export const SELF: PackageDep = {
  pkg: "@aabuhijleh/abed-hub",
  bin: "abed-hub",
};

/** The skill that teaches an agent to run `doctor` when a tool goes missing. */
export const SELF_SKILL: SkillDep = {
  name: "abed-hub",
  repo: HUB,
  dir: "skills",
};

export const SPECS: Record<Component, ComponentSpec> = {
  "gh-attach": {
    summary: "Put a screenshot into a PR or issue",
    packages: [{ pkg: "@aabuhijleh/gh-attach", bin: "gh-attach" }],
    skills: [{ name: "gh-attach", repo: HUB, dir: "skills" }],
    tools: ["gh", "gh-auth"],
  },
  "gh-stack": {
    summary: "Break a change into PRs that build on each other",
    packages: [],
    skills: [{ name: "gh-stack", repo: HUB, dir: "skills" }],
    tools: ["gh", "gh-auth", "gh-stack-ext"],
  },
  "writing-great-prs": {
    summary: "Write a PR description with a screenshot in it",
    packages: [{ pkg: "@playwright/cli", bin: "playwright-cli" }],
    skills: [
      { name: "writing-great-prs", repo: HUB, dir: "skills" },
      {
        name: "playwright-cli",
        repo: "microsoft/playwright-cli",
        dir: "skills",
      },
      {
        name: "unslop",
        repo: "cursor/plugins",
        dir: "pstack/skills",
        patchInvocation: true,
      },
    ],
    tools: ["chromium"],
    needs: ["gh-attach"],
  },
  courier: {
    summary: "Move files in and out of Jira issues and Slack threads",
    packages: [{ pkg: "@aabuhijleh/courier", bin: "jira" }],
    skills: [{ name: "courier", repo: HUB, dir: "skills" }],
    tools: ["jira-credentials", "slack-credentials"],
  },
};

export function isComponent(value: string): value is Component {
  return (COMPONENTS as readonly string[]).includes(value);
}

/** `prs` is shorter to type and `all` is what most people mean. */
export function resolveAlias(value: string): Component[] | null {
  if (value === "all") return [...COMPONENTS];
  if (value === "prs") return ["writing-great-prs"];
  return isComponent(value) ? [value] : null;
}

/** Close a selection over `needs`, in registry order, without duplicates. */
export function expand(selected: Iterable<Component>): Component[] {
  const wanted = new Set<Component>();
  const visit = (name: Component) => {
    if (wanted.has(name)) return;
    wanted.add(name);
    for (const dep of SPECS[name].needs ?? []) visit(dep);
  };
  for (const name of selected) visit(name);
  return COMPONENTS.filter((name) => wanted.has(name));
}
