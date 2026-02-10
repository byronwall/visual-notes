import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export const DEFAULT_DOC_IMAGE_URL_PREFIX = "/api/doc-images";
const DOC_IMAGE_NAME_REGEX = /^[a-f0-9]{64}\.[a-z0-9]+$/i;
const execFileAsync = promisify(execFile);

export type PersistedImage = {
  filename: string;
  publicUrl: string;
  mime: string;
};

export function resolveDocImageStorageDir(): string {
  const fromEnv = process.env.DOC_IMAGE_STORAGE_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "data", "doc-images");
}

function sha256Hex(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function isValidDocImageName(name: string): boolean {
  return DOC_IMAGE_NAME_REGEX.test(name);
}

export function contentTypeForDocImageExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "bmp":
      return "image/bmp";
    case "ico":
      return "image/x-icon";
    case "avif":
      return "image/avif";
    case "heic":
      return "image/heic";
    default:
      return "application/octet-stream";
  }
}

export function contentTypeForDocImageName(name: string): string {
  const idx = name.lastIndexOf(".");
  const ext = idx >= 0 ? name.slice(idx + 1) : "";
  return contentTypeForDocImageExtension(ext);
}

async function transcodeHeicPathToJpeg(inputPath: string, outputPath: string) {
  if (process.platform !== "darwin") {
    throw new Error("HEIC transcoding currently requires macOS sips");
  }
  await execFileAsync("/usr/bin/sips", [
    "-s",
    "format",
    "jpeg",
    inputPath,
    "--out",
    outputPath,
  ]);
}

async function transcodeHeicBufferToJpeg(input: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "vn-heic-"));
  const inPath = path.join(dir, "in.heic");
  const outPath = path.join(dir, "out.jpg");
  try {
    await writeFile(inPath, input);
    await transcodeHeicPathToJpeg(inPath, outPath);
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const m = dataUrl.match(/^data:([^,;]+)((?:;[^,]+)*?),(.*)$/is);
  if (!m) throw new Error("Invalid data URL");
  const mime = (m[1] || "application/octet-stream").toLowerCase();
  const params = (m[2] || "").toLowerCase();
  const payload = m[3] || "";
  const isBase64 = params.includes(";base64");
  const buffer = isBase64
    ? Buffer.from(payload.replace(/\s+/g, ""), "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  if (!buffer.length) throw new Error("Decoded empty payload");
  return { mime, buffer };
}

function detectImageType(
  buffer: Buffer,
  declaredMime: string
): { ext: string; mime: string } {
  const first = buffer.subarray(0, 32);
  const asAscii = first.toString("ascii");
  const asUtf8 = first.toString("utf8");

  if (
    first[0] === 0x89 &&
    first[1] === 0x50 &&
    first[2] === 0x4e &&
    first[3] === 0x47
  ) {
    return { ext: "png", mime: "image/png" };
  }
  if (first[0] === 0xff && first[1] === 0xd8 && first[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (asAscii.startsWith("GIF87a") || asAscii.startsWith("GIF89a")) {
    return { ext: "gif", mime: "image/gif" };
  }
  if (
    asAscii.startsWith("RIFF") &&
    buffer.length >= 12 &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 12).toString("ascii") === "ftypavif"
  ) {
    return { ext: "avif", mime: "image/avif" };
  }
  if (
    buffer.length >= 12 &&
    ["ftypheic", "ftypheix", "ftyphevc", "ftyphevx"].includes(
      buffer.subarray(4, 12).toString("ascii")
    )
  ) {
    return { ext: "heic", mime: "image/heic" };
  }
  if (first[0] === 0x42 && first[1] === 0x4d) {
    return { ext: "bmp", mime: "image/bmp" };
  }
  if (
    first[0] === 0x00 &&
    first[1] === 0x00 &&
    first[2] === 0x01 &&
    first[3] === 0x00
  ) {
    return { ext: "ico", mime: "image/x-icon" };
  }
  if (
    declaredMime === "image/svg+xml" ||
    asUtf8.trimStart().startsWith("<svg") ||
    asUtf8.trimStart().startsWith("<?xml")
  ) {
    return { ext: "svg", mime: "image/svg+xml" };
  }

  const byMime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/x-icon": "ico",
    "image/avif": "avif",
    "image/heic": "heic",
  };
  const ext = byMime[declaredMime] || "bin";
  return {
    ext,
    mime: declaredMime.startsWith("image/") ? declaredMime : "image/*",
  };
}

export function extractDataImageUrls(text: string): string[] {
  const urls = new Set<string>();
  const htmlSrcPattern = /src=(["'])(data:image\/[^"']+)\1/gi;
  const markdownImgPattern = /!\[[^\]]*]\((data:image\/[^)]+)\)/gi;

  let m: RegExpExecArray | null;
  while ((m = htmlSrcPattern.exec(text)) !== null) urls.add(m[2]);
  while ((m = markdownImgPattern.exec(text)) !== null) urls.add(m[1]);

  return Array.from(urls);
}

export function extractHeicDocImageUrls(text: string): string[] {
  const urls = new Set<string>();
  const htmlSrcPattern =
    /src=(["'])((?:https?:\/\/[^"']+)?\/api\/doc-images\/[a-f0-9]{64}\.heic)\1/gi;
  const markdownImgPattern =
    /!\[[^\]]*]\(((?:https?:\/\/[^)]+)?\/api\/doc-images\/[a-f0-9]{64}\.heic)\)/gi;

  let m: RegExpExecArray | null;
  while ((m = htmlSrcPattern.exec(text)) !== null) urls.add(m[2]);
  while ((m = markdownImgPattern.exec(text)) !== null) urls.add(m[1]);

  return Array.from(urls);
}

export function replaceDataUrls(
  text: string,
  replacements: Map<string, string>
): string {
  let out = text.replace(/src=(["'])(data:image\/[^"']+)\1/gi, (full, q, src) => {
    const next = replacements.get(src);
    if (!next) return full;
    return `src=${q}${next}${q}`;
  });
  out = out.replace(/!\[([^\]]*)]\((data:image\/[^)]+)\)/gi, (full, alt, src) => {
    const next = replacements.get(src);
    if (!next) return full;
    return `![${alt}](${next})`;
  });
  return out;
}

export function replaceExactUrls(
  text: string,
  replacements: Map<string, string>
): string {
  let out = text;
  for (const [from, to] of replacements.entries()) {
    out = out.split(from).join(to);
  }
  return out;
}

export function parseDocImageNameFromUrl(url: string): string | null {
  try {
    const normalized = new URL(url, "http://localhost");
    const m = normalized.pathname.match(
      /\/api\/doc-images\/([a-f0-9]{64}\.[a-z0-9]+)$/i
    );
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export async function ensureJpegForHeicFile(
  storageDir: string,
  heicFileName: string,
  urlPrefix: string = DEFAULT_DOC_IMAGE_URL_PREFIX
): Promise<{ fileName: string; publicUrl: string }> {
  if (!isValidDocImageName(heicFileName)) {
    throw new Error("Invalid doc image filename");
  }
  if (!heicFileName.toLowerCase().endsWith(".heic")) {
    throw new Error("Filename is not HEIC");
  }

  const base = heicFileName.slice(0, -".heic".length);
  const jpegFileName = `${base}.jpg`;
  const heicPath = path.join(storageDir, heicFileName);
  const jpegPath = path.join(storageDir, jpegFileName);

  await mkdir(storageDir, { recursive: true });
  if (!existsSync(jpegPath)) {
    await transcodeHeicPathToJpeg(heicPath, jpegPath);
  }
  return {
    fileName: jpegFileName,
    publicUrl: `${urlPrefix}/${jpegFileName}`,
  };
}

export async function persistDataImage(
  dataUrl: string,
  storageDir: string,
  urlPrefix: string = DEFAULT_DOC_IMAGE_URL_PREFIX
): Promise<PersistedImage> {
  const parsed = parseDataUrl(dataUrl);
  const kind = detectImageType(parsed.buffer, parsed.mime);
  const hash = sha256Hex(parsed.buffer);
  const filename = `${hash}.${kind.ext}`;
  const abs = path.join(storageDir, filename);

  await mkdir(storageDir, { recursive: true });
  if (!existsSync(abs)) {
    await writeFile(abs, parsed.buffer);
  }

  if (kind.ext === "heic") {
    try {
      const jpeg = await transcodeHeicBufferToJpeg(parsed.buffer);
      const jpegFilename = `${hash}.jpg`;
      const jpegPath = path.join(storageDir, jpegFilename);
      if (!existsSync(jpegPath)) {
        await writeFile(jpegPath, jpeg);
      }
      return {
        filename: jpegFilename,
        publicUrl: `${urlPrefix}/${jpegFilename}`,
        mime: "image/jpeg",
      };
    } catch (e) {
      console.log(
        "[inline-image-migration] HEIC transcode failed; keeping .heic",
        e
      );
    }
  }

  return { filename, publicUrl: `${urlPrefix}/${filename}`, mime: kind.mime };
}

export function computeContentHashForDoc(html: string, markdown: string): string {
  const input = html.trim().length > 0 ? html : markdown;
  return sha256Hex(input);
}
