import type { Finding } from "./finding";
import { installedPackages, latestVersion } from "./packages";
import type { Component, PackageDep, SkillDep, ToolId } from "./registry";
import { SELF, SELF_SKILL, SPECS } from "./registry";
import {
  enableModelInvocation,
  isInstalled,
  isModelInvocationDisabled,
  readLock,
  remoteHashes,
} from "./skills";
import { checkTool } from "./tools";
import { compareVersions } from "./utils";

export interface Inspection {
  /** Grouped the way the report prints them, one group per kind. */
  packages: Finding[];
  skills: Finding[];
  tools: Finding[];
}

/** bun is not tied to a component; nothing here runs without it. */
const ALWAYS: ToolId[] = ["bun"];

/** Report order, so the output does not shuffle with the selection. */
const TOOL_ORDER: ToolId[] = [
  "bun",
  "gh",
  "gh-auth",
  "gh-stack-ext",
  "chromium",
  "jira-credentials",
  "slack-credentials",
];

function addPackage(pkg: string): string[] {
  return ["bun", "add", "-g", pkg];
}

function addSkill(skill: SkillDep): string[] {
  return ["bunx", "skills", "add", skill.repo, "-s", skill.name, "-g", "-y"];
}

function updateSkill(skill: SkillDep): string[] {
  return ["bunx", "skills", "update", skill.name, "-g", "-y"];
}

async function inspectPackage(
  dep: PackageDep,
  installed: Map<string, string>,
): Promise<Finding> {
  const here = installed.get(dep.pkg);
  const latest = await latestVersion(dep.pkg);

  if (!here) {
    // The CLI is plainly running, so it came from somewhere: a checkout, or
    // bunx. Saying it is missing and offering to install it over itself is
    // noise, not a finding.
    if (dep.pkg === SELF.pkg) {
      return {
        kind: "package",
        name: dep.pkg,
        status: "ok",
        detail: "running from source",
      };
    }
    return {
      kind: "package",
      name: dep.pkg,
      status: "missing",
      detail: "not installed",
      fix: {
        run: "command",
        argv: addPackage(dep.pkg),
        label: `bun add -g ${dep.pkg}`,
      },
    };
  }

  if (latest && compareVersions(here, latest) < 0) {
    return {
      kind: "package",
      name: dep.pkg,
      status: "stale",
      detail: `${here} → ${latest}`,
      fix: {
        run: "command",
        argv: addPackage(dep.pkg),
        label: `bun add -g ${dep.pkg}`,
      },
    };
  }

  return {
    kind: "package",
    name: dep.pkg,
    status: "ok",
    detail: latest ? here : `${here}, npm did not answer`,
  };
}

async function inspectSkill(
  dep: SkillDep,
  lock: Map<string, { skillFolderHash: string }>,
  remote: Map<string, Map<string, string>>,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  if (!(await isInstalled(dep.name))) {
    findings.push({
      kind: "skill",
      name: dep.name,
      status: "missing",
      detail: "not installed",
      fix: {
        run: "command",
        argv: addSkill(dep),
        label: `skills add ${dep.repo} -s ${dep.name}`,
      },
    });
    return findings;
  }

  const here = lock.get(dep.name)?.skillFolderHash;
  const there = remote.get(`${dep.repo}/${dep.dir}`)?.get(dep.name);

  if (!here) {
    findings.push({
      kind: "skill",
      name: dep.name,
      status: "ok",
      detail: "installed, not in the lock file",
    });
  } else if (!there) {
    findings.push({
      kind: "skill",
      name: dep.name,
      status: "ok",
      detail: `installed, ${dep.repo} did not answer`,
    });
  } else if (here !== there) {
    findings.push({
      kind: "skill",
      name: dep.name,
      status: "stale",
      detail: `behind ${dep.repo}`,
      fix: {
        run: "command",
        argv: updateSkill(dep),
        label: `skills update ${dep.name}`,
      },
    });
  } else {
    findings.push({
      kind: "skill",
      name: dep.name,
      status: "ok",
      detail: here.slice(0, 7),
    });
  }

  if (dep.patchInvocation && (await isModelInvocationDisabled(dep.name))) {
    findings.push({
      kind: "skill",
      name: `${dep.name} invocation`,
      status: "broken",
      detail: "disable-model-invocation is back",
      fix: {
        run: "local",
        apply: () => enableModelInvocation(dep.name),
        label: `let agents invoke ${dep.name}`,
      },
    });
  }

  return findings;
}

/** Skills whose invocation this CLI patches after every install and update. */
export function patchedSkills(components: Component[]): SkillDep[] {
  return components
    .flatMap((name) => SPECS[name].skills)
    .filter((skill) => skill.patchInvocation);
}

/**
 * Re-apply every invocation patch for the selected components. `skills update`
 * overwrites SKILL.md with upstream's copy, which puts the key back, so this
 * runs after the fixes rather than as one of them.
 */
export async function repairPatches(
  components: Component[],
): Promise<string[]> {
  const repaired: string[] = [];
  for (const skill of patchedSkills(components)) {
    if (await isModelInvocationDisabled(skill.name)) {
      await enableModelInvocation(skill.name);
      repaired.push(skill.name);
    }
  }
  return repaired;
}

export async function inspect(components: Component[]): Promise<Inspection> {
  const specs = components.map((name) => SPECS[name]);

  const packageDeps = [SELF, ...specs.flatMap((spec) => spec.packages)];
  const skillDeps = [SELF_SKILL, ...specs.flatMap((spec) => spec.skills)];
  const toolIds = TOOL_ORDER.filter((id) =>
    [...ALWAYS, ...specs.flatMap((spec) => spec.tools)].includes(id),
  );

  // One contents call per repo directory, not one per skill.
  const dirs = new Map<string, SkillDep>();
  for (const dep of skillDeps) dirs.set(`${dep.repo}/${dep.dir}`, dep);

  const [installed, lock, remoteEntries] = await Promise.all([
    installedPackages(),
    readLock(),
    Promise.all(
      [...dirs].map(
        async ([key, dep]) =>
          [key, await remoteHashes(dep.repo, dep.dir)] as const,
      ),
    ),
  ]);
  const remote = new Map(remoteEntries);

  const [packages, skills, tools] = await Promise.all([
    Promise.all(packageDeps.map((dep) => inspectPackage(dep, installed))),
    Promise.all(skillDeps.map((dep) => inspectSkill(dep, lock, remote))),
    Promise.all(toolIds.map((id) => checkTool(id))),
  ]);

  return { packages, skills: skills.flat(), tools };
}

export function allFindings(inspection: Inspection): Finding[] {
  return [...inspection.packages, ...inspection.skills, ...inspection.tools];
}
