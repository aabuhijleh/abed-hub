import { describe, expect, test } from "bun:test";
import { withPngTitle } from "./png-title";

// A 1x1 white PNG, and the iTXt chunk Python's zlib writes for the title below.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC",
  "base64",
);
const TITLE = "Rows 136 and 143 now tie → ✓";
const TITLE_CHUNK = Buffer.from(
  "0000002a695458745469746c650000000000526f77732031333620616e6420313433206e6f772074696520e2869220e29c93e713b71c",
  "hex",
);
const AFTER_IHDR = 8 + 25;

describe("withPngTitle", () => {
  test("puts the title in a UTF-8 iTXt chunk right after IHDR", () => {
    const expected = Buffer.concat([
      PNG.subarray(0, AFTER_IHDR),
      TITLE_CHUNK,
      PNG.subarray(AFTER_IHDR),
    ]);
    expect(Buffer.from(withPngTitle(PNG, TITLE))).toEqual(expected);
  });

  test("refuses bytes that are not a PNG", () => {
    expect(() => withPngTitle(Buffer.from("not a png"), TITLE)).toThrow(
      "not a PNG",
    );
  });
});
