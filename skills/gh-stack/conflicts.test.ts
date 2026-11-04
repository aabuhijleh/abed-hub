import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const script = path.join(import.meta.dir, "conflicts.sh");

let repo: string;

// A git hook exports GIT_DIR, which would point these commands at the outer repo.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
);

function git(...args: string[]) {
  const run = Bun.spawnSync(["git", ...args], { cwd: repo, env });
  if (run.exitCode !== 0) throw new Error(run.stderr.toString());
}

async function commit(branch: string, file: string, text: string) {
  git("checkout", "-q", branch);
  await writeFile(path.join(repo, file), text);
  git("add", file);
  git("commit", "-q", "-m", `${branch} edits ${file}`);
}

function conflicts(base: string, head: string): string {
  return Bun.spawnSync(["bash", script, base, head], { cwd: repo, env })
    .stdout.toString()
    .trim();
}

beforeEach(async () => {
  repo = await mkdtemp(path.join(tmpdir(), "gh-stack-conflicts-"));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  await writeFile(path.join(repo, "a.ts"), "one\n");
  git("add", "a.ts");
  git("commit", "-q", "-m", "start");
  git("branch", "feature");
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("conflicts.sh", () => {
  test("names the files both sides changed", async () => {
    await commit("main", "a.ts", "main\n");
    await commit("feature", "a.ts", "feature\n");
    expect(conflicts("main", "feature")).toBe("a.ts");
  });

  test("prints nothing when the merge is clean", async () => {
    await commit("main", "a.ts", "main\n");
    await commit("feature", "b.ts", "feature\n");
    expect(conflicts("main", "feature")).toBe("");
  });
});
