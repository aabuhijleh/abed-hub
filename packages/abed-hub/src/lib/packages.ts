import { capture } from "./exec";

/** Global package name to installed version, read once per run. */
export async function installedPackages(): Promise<Map<string, string>> {
  const versions = new Map<string, string>();
  const { ok, stdout } = await capture(["bun", "pm", "ls", "-g"]);
  if (!ok) return versions;

  for (const line of stdout.split("\n")) {
    // "├── @aabuhijleh/gh-attach@0.1.0". The last @ splits the scope off.
    const entry = line.replace(/^[│├└─\s]+/, "").trim();
    const at = entry.lastIndexOf("@");
    if (at <= 0) continue;
    const name = entry.slice(0, at);
    const version = entry.slice(at + 1);
    if (/^\d/.test(version)) versions.set(name, version);
  }
  return versions;
}

/**
 * The latest version on npm, or null when the registry does not answer or has
 * never heard of the package. Null means "could not check", never "behind":
 * a package published minutes ago and one that does not exist look the same
 * from here, and neither is worth stopping a setup over.
 */
export async function latestVersion(pkg: string): Promise<string | null> {
  const url = `https://registry.npmjs.org/${pkg.replace("/", "%2f")}/latest`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}
