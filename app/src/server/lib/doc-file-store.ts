import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  cleanFileName,
  DOC_FILE_MAX_BYTES,
  docFileSrc,
  fileExtension,
  type DocFileUploadResult,
} from "~/services/doc-files/doc-files.shared";
import { fetchPublicFile, PublicFetchError } from "~/server/lib/public-fetch";

// File attachments on disk: bytes stored once under their sha256 (no
// extension), so the same file attached twice, or by two notes, is one copy.
// The type comes from the file name at serve time, through an allowlist, so a
// name chosen by a caller can never make the app serve script inline.

export { DOC_FILE_MAX_BYTES };

const HASH = /^[a-f0-9]{64}$/;

export function resolveDocFileStorageDir(): string {
  const fromEnv = process.env.DOC_FILE_STORAGE_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "data", "doc-files");
}

export function docFilePath(hash: string): string | null {
  return HASH.test(hash) ? path.join(resolveDocFileStorageDir(), hash) : null;
}

/** The caller sent something that cannot be stored as a file. */
export class FileRejectedError extends Error {}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  heic: "image/heic",
  tif: "image/tiff",
  tiff: "image/tiff",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  txt: "text/plain",
  md: "text/markdown",
  log: "text/plain",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  yaml: "application/yaml",
  yml: "application/yaml",
  xml: "application/xml",
  html: "text/html",
  htm: "text/html",
  svg: "image/svg+xml",
  zip: "application/zip",
  gz: "application/gzip",
  tgz: "application/gzip",
  tar: "application/x-tar",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf",
  epub: "application/epub+zip",
  ipynb: "application/x-ipynb+json",
};

const EXTENSION_BY_MIME = Object.fromEntries(
  Object.entries(MIME_BY_EXTENSION)
    .reverse()
    .map(([ext, mime]) => [mime, ext]),
);

/** The type a file name implies; unknown extensions are plain bytes. */
export function mimeForFileName(name: string): string {
  return MIME_BY_EXTENSION[fileExtension(name)] ?? "application/octet-stream";
}

/** Types a browser can show without running anything from our origin. */
const INLINE_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

/** Text that is shown inline as plain text, never parsed as a document. */
const INLINE_AS_TEXT = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/tab-separated-values",
  "application/json",
  "application/yaml",
]);

/**
 * Response headers for a stored file. Media and PDFs open in the browser;
 * text shows as plain text; everything else (HTML, SVG, Office files, ...)
 * downloads. Nothing is sniffed, and non-PDF responses are sandboxed.
 */
export function docFileHeaders(
  name: string,
  options: { download?: boolean } = {},
): Record<string, string> {
  const mime = mimeForFileName(name);
  const asText = INLINE_AS_TEXT.has(mime);
  const inline = !options.download && (INLINE_MIME.has(mime) || asText);
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const headers: Record<string, string> = {
    "content-type":
      asText && inline
        ? "text/plain; charset=utf-8"
        : inline
          ? mime
          : "application/octet-stream",
    "content-disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "x-content-type-options": "nosniff",
    "cache-control": "public, max-age=31536000, immutable",
    "accept-ranges": "bytes",
  };
  // Chrome's PDF viewer refuses to load in a sandboxed document.
  if (mime !== "application/pdf") {
    headers["content-security-policy"] =
      "sandbox; default-src 'none'; img-src 'self'; media-src 'self'";
  }
  return headers;
}

/** Recognizes common formats from their first bytes, for names without an extension. */
export function sniffExtension(buffer: Buffer): string | null {
  const head = buffer.subarray(0, 16);
  const ascii = head.toString("latin1");
  if (ascii.startsWith("%PDF-")) return "pdf";
  if (head[0] === 0x89 && ascii.slice(1, 4) === "PNG") return "png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpg";
  if (ascii.startsWith("GIF8")) return "gif";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "webp";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE") return "wav";
  if (ascii.startsWith("PK\u0003\u0004")) return "zip";
  if (head[0] === 0x1f && head[1] === 0x8b) return "gz";
  if (ascii.startsWith("ID3")) return "mp3";
  if (ascii.startsWith("OggS")) return "ogg";
  if (ascii.startsWith("fLaC")) return "flac";
  if (ascii.slice(4, 8) === "ftyp")
    return ascii.slice(8, 11) === "M4A" ? "m4a" : "mp4";
  if (
    head[0] === 0x1a &&
    head[1] === 0x45 &&
    head[2] === 0xdf &&
    head[3] === 0xa3
  )
    return "webm";
  return null;
}

/** Picks the stored name: the caller's, with an extension added when it has none. */
export function nameForFile(
  buffer: Buffer,
  rawName: string | undefined,
  declaredMime = "",
): string {
  const name = cleanFileName(rawName ?? "", "file");
  if (fileExtension(name)) return name;
  const base = declaredMime.split(";")[0]!.trim().toLowerCase();
  const ext = sniffExtension(buffer) ?? EXTENSION_BY_MIME[base];
  return ext ? `${name}.${ext}` : name;
}

export type StoredFile = DocFileUploadResult & { hash: string };

/** Stores bytes under their content hash and returns where they are served. */
export async function storeFileBytes(
  buffer: Buffer,
  input: { name?: string; mime?: string; label?: string } = {},
): Promise<StoredFile> {
  const label = input.label ?? "The file";
  if (!buffer.length) throw new FileRejectedError(`${label} is empty`);
  if (buffer.length > DOC_FILE_MAX_BYTES) {
    throw new FileRejectedError(
      `${label} is larger than ${DOC_FILE_MAX_BYTES / 1e6} MB`,
    );
  }
  const hash = createHash("sha256").update(buffer).digest("hex");
  const dir = resolveDocFileStorageDir();
  const abs = path.join(dir, hash);
  const existing = await stat(abs).catch(() => null);
  if (existing?.size !== buffer.length) {
    await mkdir(dir, { recursive: true });
    // Write then rename, so a reader never sees half a file.
    const temp = path.join(dir, `.${hash}.${randomUUID()}.tmp`);
    try {
      await writeFile(temp, buffer);
      await rename(temp, abs);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }
  const name = nameForFile(buffer, input.name, input.mime);
  return {
    hash,
    src: docFileSrc(hash, name),
    name,
    mime: mimeForFileName(name),
    bytes: buffer.length,
  };
}

/** Size of a stored file, or null when there is no such file. */
export async function storedFileSize(hash: string): Promise<number | null> {
  const abs = docFilePath(hash);
  if (!abs) return null;
  const info = await stat(abs).catch(() => null);
  return info?.isFile() ? info.size : null;
}

/** `filename*=` or `filename=` from a Content-Disposition header. */
export function fileNameFromDisposition(header: string): string | null {
  const star = header.match(/filename\*\s*=\s*(?:UTF-8|utf-8)?''([^;]+)/);
  if (star) {
    try {
      return decodeURIComponent(star[1]!.trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain parameter
    }
  }
  const plain = header.match(/filename\s*=\s*("([^"]*)"|[^;]+)/);
  return plain ? (plain[2] ?? plain[1]!).trim() || null : null;
}

function fileNameFromUrl(url: string): string | null {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

export type FetchedUpload = { buffer: Buffer; name?: string; mime: string };

/** Downloads a public file; private networks are refused. */
export async function fetchFileFromUrl(
  url: string,
  input: { name?: string; mime?: string } = {},
): Promise<FetchedUpload> {
  let fetched: Awaited<ReturnType<typeof fetchPublicFile>>;
  try {
    fetched = await fetchPublicFile(url, {
      maxBytes: DOC_FILE_MAX_BYTES,
      timeoutMs: 30_000,
      accept: "*/*",
    });
  } catch (error) {
    if (error instanceof PublicFetchError)
      throw new FileRejectedError(error.message);
    throw error;
  }
  return {
    buffer: fetched.buffer,
    name:
      input.name?.trim() ||
      fileNameFromDisposition(fetched.contentDisposition) ||
      fileNameFromUrl(fetched.finalUrl) ||
      undefined,
    mime: input.mime || fetched.contentType,
  };
}

/** Downloads a public file and stores it. */
export async function importFileFromUrl(
  url: string,
  input: { name?: string; mime?: string } = {},
): Promise<StoredFile> {
  const { buffer, name, mime } = await fetchFileFromUrl(url, input);
  return storeFileBytes(buffer, { name, mime, label: "The downloaded file" });
}
