import { chmod, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/**
 * Every abed-hub CLI keeps its state in one place:
 *
 *   ${XDG_CONFIG_HOME:-~/.config}/abed-hub/<tool>/
 *
 * Files hold API tokens and session cookies, so this module owns the
 * permissions too: 0700 on the directory, 0600 on each file. Both are no-ops
 * on Windows, which has no POSIX mode bits.
 */
const NAMESPACE = "abed-hub";

function configHome(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  return xdg ? xdg : path.join(homedir(), ".config");
}

/** The directory a tool owns. Does not create it. */
export function toolDir(tool: string): string {
  return path.join(configHome(), NAMESPACE, tool);
}

/** A path inside a tool's directory. Does not create anything. */
export function toolFile(tool: string, name: string): string {
  return path.join(toolDir(tool), name);
}

/** Create a tool's directory, owner-only. Safe to call repeatedly. */
export async function ensureToolDir(tool: string): Promise<string> {
  const dir = toolDir(tool);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/** Read a file as text, or null when it does not exist or cannot be read. */
export async function readFile(
  tool: string,
  name: string,
): Promise<string | null> {
  const file = Bun.file(toolFile(tool, name));
  if (!(await file.exists())) return null;
  try {
    return await file.text();
  } catch {
    return null;
  }
}

/** Parse a file as JSON, or null when it is missing, unreadable, or not an object. */
export async function readJson<T = Record<string, unknown>>(
  tool: string,
  name: string,
): Promise<T | null> {
  const text = await readFile(tool, name);
  if (text === null) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return null;
    return parsed as T;
  } catch {
    return null;
  }
}

/** Write a file owner-readable, creating the directory first. */
export async function writeFile(
  tool: string,
  name: string,
  contents: string,
): Promise<string> {
  await ensureToolDir(tool);
  const filePath = toolFile(tool, name);
  await Bun.write(filePath, contents);
  await chmod(filePath, 0o600).catch(() => {});
  return filePath;
}

/** Write pretty JSON with a trailing newline. */
export async function writeJson(
  tool: string,
  name: string,
  value: unknown,
): Promise<string> {
  return writeFile(tool, name, `${JSON.stringify(value, null, 2)}\n`);
}

/** Keep the last 4 characters so a secret is identifiable but not exposed. */
export function maskSecret(secret: string): string {
  return secret.length <= 4
    ? "•".repeat(8)
    : `${"•".repeat(8)}${secret.slice(-4)}`;
}
