import { errorMessage } from "./utils";

export interface RunResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Every child runs with stdin closed. `skills add` and `gh` both prompt when
 * they find a terminal, and a prompt nobody answers is a hang with no output,
 * so nothing here is allowed to ask.
 */
export async function capture(argv: string[]): Promise<RunResult> {
  const [cmd, ...args] = argv;
  if (!cmd) throw new Error("capture needs a command");

  try {
    const proc = Bun.spawn([cmd, ...args], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { ok: code === 0, code, stdout, stderr };
  } catch (err) {
    // A missing binary throws rather than exiting, so give it an exit code.
    return { ok: false, code: 127, stdout: "", stderr: errorMessage(err) };
  }
}

/**
 * Run with both streams on the terminal. Only for the chromium download, which
 * is over 350 MB and looks hung for minutes without its own progress bar.
 */
export async function captureLoud(argv: string[]): Promise<RunResult> {
  const [cmd, ...args] = argv;
  if (!cmd) throw new Error("captureLoud needs a command");

  try {
    const proc = Bun.spawn([cmd, ...args], {
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
    });
    const code = await proc.exited;
    return { ok: code === 0, code, stdout: "", stderr: "" };
  } catch (err) {
    return { ok: false, code: 127, stdout: "", stderr: errorMessage(err) };
  }
}

let bunBin: string | null | undefined;

/** bun's global bin directory, which a fresh shell often does not have on PATH. */
async function globalBinDir(): Promise<string | null> {
  if (bunBin !== undefined) return bunBin;
  const { ok, stdout } = await capture(["bun", "pm", "bin", "-g"]);
  bunBin = ok && stdout.trim() ? stdout.trim() : null;
  return bunBin;
}

/** True when a binary is runnable, including one installed by bun this run. */
export async function has(bin: string): Promise<boolean> {
  if (Bun.which(bin)) return true;
  const dir = await globalBinDir();
  return dir !== null && Bun.which(bin, { PATH: dir }) !== null;
}
