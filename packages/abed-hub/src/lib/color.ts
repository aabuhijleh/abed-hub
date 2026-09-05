/**
 * @clack/prompts dropped picocolors in 1.7, and this CLI needs six escape
 * codes. Not worth a dependency.
 */
const enabled =
  !process.env.NO_COLOR &&
  process.env.TERM !== "dumb" &&
  process.stdout.isTTY === true;

function wrap(open: number, close: number) {
  return (text: string) =>
    enabled ? `\x1b[${open}m${text}\x1b[${close}m` : text;
}

export const bold = wrap(1, 22);
export const dim = wrap(2, 22);
export const red = wrap(31, 39);
export const green = wrap(32, 39);
export const yellow = wrap(33, 39);
export const cyan = wrap(36, 39);
