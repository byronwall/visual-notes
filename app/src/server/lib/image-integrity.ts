// Checks that image bytes are whole, without decoding pixels. Each format is
// walked by its own structure (PNG chunks to IEND, JPEG segments to EOI, the
// RIFF, BMP, and ISO-BMFF sizes, the GIF trailer), so bytes cut off part way,
// such as base64 an agent stopped copying early, are refused instead of being
// stored as a half-grey picture. Dimensions come from the headers.

export type ImageCheck =
  | { ok: true; width: number | null; height: number | null }
  | { ok: false; problem: string };

const cut = (where: string): ImageCheck => ({
  ok: false,
  problem: `is cut off (${where}); send the whole file again`,
});

const sized = (width: number | null, height: number | null): ImageCheck => ({
  ok: true,
  width: width || null,
  height: height || null,
});

function checkPng(b: Buffer): ImageCheck {
  let width: number | null = null;
  let height: number | null = null;
  for (let at = 8; ; ) {
    if (at + 8 > b.length) return cut("no IEND chunk");
    const length = b.readUInt32BE(at);
    const type = b.toString("ascii", at + 4, at + 8);
    const end = at + 12 + length;
    if (end > b.length) return cut(`${type} chunk runs past the end`);
    if (type === "IHDR" && length >= 8) {
      width = b.readUInt32BE(at + 8);
      height = b.readUInt32BE(at + 12);
    }
    if (type === "IEND") return sized(width, height);
    at = end;
  }
}

const JPEG_SOF = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const EOI = Buffer.from([0xff, 0xd9]);

function checkJpeg(b: Buffer): ImageCheck {
  let width: number | null = null;
  let height: number | null = null;
  for (let at = 2; ; ) {
    if (at + 4 > b.length) return cut("no image data");
    if (b[at] !== 0xff) return cut("broken segment");
    const marker = b[at + 1]!;
    if (marker === 0xff) {
      at += 1; // fill byte
      continue;
    }
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      at += 2;
      continue;
    }
    const length = b.readUInt16BE(at + 2);
    const end = at + 2 + length;
    if (end > b.length) return cut("segment runs past the end");
    if (JPEG_SOF.has(marker) && length >= 7) {
      height = b.readUInt16BE(at + 5);
      width = b.readUInt16BE(at + 7);
    }
    if (marker === 0xda) {
      // Entropy-coded data stuffs every 0xFF it holds, so the next FF D9 is
      // the end of the image, after any further progressive scans.
      return b.indexOf(EOI, end) === -1
        ? cut("no end-of-image marker")
        : sized(width, height);
    }
    at = end;
  }
}

function checkGif(b: Buffer): ImageCheck {
  if (b.length < 14) return cut("no header");
  let last = b.length - 1;
  while (last > 13 && b[last] === 0) last -= 1;
  if (b[last] !== 0x3b) return cut("no trailer");
  return sized(b.readUInt16LE(6), b.readUInt16LE(8));
}

function checkWebp(b: Buffer): ImageCheck {
  if (b.length < 30) return cut("no header");
  if (b.readUInt32LE(4) + 8 > b.length)
    return cut("shorter than its RIFF size");
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X")
    return sized(b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1);
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return sized((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
  }
  if (chunk === "VP8 ")
    return sized(b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff);
  return sized(null, null);
}

function checkBmp(b: Buffer): ImageCheck {
  if (b.length < 26) return cut("no header");
  if (b.readUInt32LE(2) > b.length) return cut("shorter than its file size");
  return sized(b.readInt32LE(18), Math.abs(b.readInt32LE(22)));
}

/** AVIF and HEIC: top-level boxes must fit the file exactly. */
function checkIsoBmff(b: Buffer): ImageCheck {
  let sawData = false;
  for (let at = 0; at < b.length; ) {
    if (at + 8 > b.length) return cut("broken box");
    let size = b.readUInt32BE(at);
    if (size === 1) {
      if (at + 16 > b.length) return cut("broken box");
      size = Number(b.readBigUInt64BE(at + 8));
    } else if (size === 0) {
      size = b.length - at;
    }
    if (size < 8) return cut("broken box");
    if (b.toString("ascii", at + 4, at + 8) === "mdat") sawData = true;
    if (at + size > b.length) return cut("a box runs past the end");
    at += size;
  }
  return sawData ? sized(null, null) : cut("no image data");
}

const CHECKS: Record<string, (b: Buffer) => ImageCheck> = {
  png: checkPng,
  jpg: checkJpeg,
  gif: checkGif,
  webp: checkWebp,
  bmp: checkBmp,
  avif: checkIsoBmff,
  heic: checkIsoBmff,
};

/** Whether the bytes of an image of this sniffed type are complete. */
export function checkImageIntegrity(buffer: Buffer, ext: string): ImageCheck {
  const check = CHECKS[ext];
  if (!check) return sized(null, null);
  try {
    return check(buffer);
  } catch {
    return cut("unreadable header");
  }
}
