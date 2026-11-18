// Reading trust settings needs an owner login, but only CI can attach provenance, so it stands in.

interface Packument {
  versions?: Record<string, { dist?: { attestations?: unknown } }>;
}

/** True when some version on npm carries a provenance attestation. */
export function stagedFromCiBefore(packument: Packument): boolean {
  return Object.values(packument.versions ?? {}).some(
    (version) => version.dist?.attestations != null,
  );
}

/** Fetches the packument. A network failure throws, so a guess never passes as a check. */
export async function trustProven(pkg: string): Promise<boolean> {
  const url = `https://registry.npmjs.org/${pkg.replace("/", "%2f")}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`registry answered ${res.status} for ${pkg}`);
  return stagedFromCiBefore((await res.json()) as Packument);
}

export function trustSettingsUrl(pkg: string): string {
  return `https://www.npmjs.com/package/${pkg}/access`;
}

/** What to register, in the words the npmjs.com form uses. */
export function trustSetup(pkg: string): string {
  return `On ${trustSettingsUrl(pkg)}, add a trusted publisher: GitHub Actions, repository aabuhijleh/abed-hub, workflow release.yml, allowed action npm stage publish.`;
}

/** npm answers E401 when no trusted publisher matches. Other failures keep npm's message. */
export function explainStageFailure(
  output: string,
  pkg: string,
  runId?: string,
): string | null {
  if (!/\bE401\b|\bENEEDAUTH\b/.test(output)) return null;
  const rerun = runId
    ? ` Then rerun the failed job: gh run rerun ${runId} --repo aabuhijleh/abed-hub --failed.`
    : "";
  return `npm rejected the CI token for ${pkg}, so it has no trusted publisher for this workflow. ${trustSetup(pkg)}${rerun}`;
}
