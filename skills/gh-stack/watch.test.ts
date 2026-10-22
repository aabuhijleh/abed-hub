import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let dir: string;

// A fake status.sh beside a copy of watch.sh, printing one queued report per run.
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "gh-stack-watch-"));
  await copyFile(
    path.join(import.meta.dir, "watch.sh"),
    path.join(dir, "watch.sh"),
  );
  await writeFile(
    path.join(dir, "status.sh"),
    `n=$(( $(cat "${dir}/runs" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "${dir}/runs"
printf '%s\\n' "$*" >> "${dir}/args"
cat "${dir}/report-$n"
exit "$(cat "${dir}/exit-$n" 2>/dev/null || echo 0)"
`,
  );
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function queue(...reports: string[]) {
  for (const [i, report] of reports.entries()) {
    await writeFile(path.join(dir, `report-${i + 1}`), report);
  }
}

async function watch(...args: string[]) {
  const run = Bun.spawnSync(
    ["bash", path.join(dir, "watch.sh"), "--interval", "0", ...args],
    { cwd: dir },
  );
  return {
    code: run.exitCode,
    out: run.stdout.toString().trim(),
    runs: Number(await readFile(path.join(dir, "runs"), "utf8")),
    args: (await readFile(path.join(dir, "args"), "utf8")).trim().split("\n"),
  };
}

describe("watch.sh", () => {
  test("polls until no check is running and prints only the settled report", async () => {
    await queue(
      "#12  ⏳ 2 running\n⏳ Checks running: #12",
      "#12  ⏳ 1 running\n⏳ Checks running: #12",
      "#12  ✅ 3 passed\n✨ Nothing to update.",
    );
    const { code, out, runs, args } = await watch("12");
    expect(code).toBe(0);
    expect(runs).toBe(3);
    expect(out).toBe("#12  ✅ 3 passed\n✨ Nothing to update.");
    expect(args).toEqual(["12", "12", "12"]);
  });

  test("waits on a computing merge state too", async () => {
    await queue("#12  ✅ 3 passed  ⏳ computing", "#12  ✅ 3 passed  🟢 ready");
    const { code, runs } = await watch();
    expect(code).toBe(0);
    expect(runs).toBe(2);
  });

  test("a layer with no checks yet waits out the grace", async () => {
    await queue("#12  ✅ 0 passed", "#12  ⏳ 1 running", "#12  ✅ 1 passed");
    expect((await watch("--grace", "60")).runs).toBe(3);
  });

  test("a layer that never gets checks settles once the grace is over", async () => {
    await queue("#12  ✅ 0 passed");
    expect((await watch("--grace", "0")).runs).toBe(1);
  });

  test("stops at the timeout with the last report and exit 124", async () => {
    await queue("#12  ⏳ 1 running");
    const { code, out, runs } = await watch("--timeout", "0");
    expect(code).toBe(124);
    expect(runs).toBe(1);
    expect(out).toBe("#12  ⏳ 1 running");
  });

  test("passes status.sh's failure through", async () => {
    await queue("PR #12 is not in a stack on GitHub.");
    await writeFile(path.join(dir, "exit-1"), "2");
    const { code, out } = await watch("12");
    expect(code).toBe(2);
    expect(out).toBe("PR #12 is not in a stack on GitHub.");
  });
});
