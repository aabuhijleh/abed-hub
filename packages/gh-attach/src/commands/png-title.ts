const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const IHDR_END = SIGNATURE.length + 4 + 4 + 13 + 4;

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(Bun.hash.crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** The PNG with `title` as its standard Title, in a UTF-8 iTXt chunk after IHDR. */
export function withPngTitle(png: Uint8Array, title: string): Uint8Array {
  const bytes = Buffer.from(png);
  if (!bytes.subarray(0, SIGNATURE.length).equals(SIGNATURE))
    throw new Error("not a PNG");
  // Keyword, then compression flag, method, language tag and translated keyword, all empty.
  const data = Buffer.concat([
    Buffer.from("Title\0\0\0\0\0", "latin1"),
    Buffer.from(title, "utf8"),
  ]);
  return Buffer.concat([
    bytes.subarray(0, IHDR_END),
    chunk("iTXt", data),
    bytes.subarray(IHDR_END),
  ]);
}
