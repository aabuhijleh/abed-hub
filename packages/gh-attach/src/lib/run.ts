export type RunResult = {
  code: number;
  stdout: string;
  stderr: string;
  /** True when the cap fired and the process was killed. */
  timedOut: boolean;
};

/**
 * Run a command with a hard cap. The cap exists because extracting the cookie
 * can raise a Keychain prompt on macOS, and a prompt nobody answers would
 * otherwise wedge the CLI forever.
 */
export async function run(
  cmd: string[],
  options: { env?: Record<string, string>; timeoutMs?: number } = {},
): Promise<RunResult> {
  const { env, timeoutMs = 30_000 } = options;

  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    env: env ? { ...process.env, ...env } : process.env,
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill(9);
  }, timeoutMs);

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timer);

  return { code: timedOut ? 124 : code, stdout, stderr, timedOut };
}

/** True when the binary is on PATH. */
export async function onPath(bin: string): Promise<boolean> {
  return (
    (await run([bin, "--version"], { timeoutMs: 10_000 }).catch(() => null))
      ?.code === 0
  );
}
