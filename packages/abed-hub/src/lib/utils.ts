export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Compare two dotted version strings. Anything after the numbers, a `-beta.1`
 * or a stray `v`, is ignored: this only ever answers "is the installed one
 * behind", and no dependency here ships prereleases.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .replace(/^v/, "")
      .split(/[.+-]/)
      .map((n) => Number.parseInt(n, 10))
      .filter((n) => Number.isFinite(n));

  const left = parts(a);
  const right = parts(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/** Pad to a column so the detail text on every report line starts together. */
export function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
