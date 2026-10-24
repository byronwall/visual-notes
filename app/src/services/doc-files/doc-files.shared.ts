// File attachments: any file a note keeps (PDF, spreadsheet, zip, ...).
// Bytes are content-addressed under /api/doc-files/<sha256>/<file name>; the
// name in the path is what a download is saved as. Shared by the editor, the
// upload route, and the MCP connector.

export const DOC_FILE_URL_PREFIX = "/api/doc-files";

export const DOC_FILE_MAX_BYTES = 50_000_000;

export type DocFileUploadResult = {
  /** Root-relative path to store in the note. */
  src: string;
  name: string;
  mime: string;
  bytes: number;
};

const SRC_PATTERN = /^\/api\/doc-files\/([a-f0-9]{64})\/([^/?#]+)$/;

/** Characters that would end a markdown link destination are encoded too. */
export const encodeFileName = (name: string) =>
  encodeURIComponent(name).replace(
    /[()'!*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );

export function docFileSrc(hash: string, name: string): string {
  return `${DOC_FILE_URL_PREFIX}/${hash}/${encodeFileName(name)}`;
}

/** The hash and file name in a stored file path, relative or on any host. */
export function parseDocFileSrc(
  src: string,
): { hash: string; name: string } | null {
  let pathname = src;
  if (!src.startsWith("/")) {
    try {
      pathname = new URL(src).pathname;
    } catch {
      return null;
    }
  }
  const match = pathname.match(SRC_PATTERN);
  if (!match) return null;
  try {
    return { hash: match[1]!, name: decodeURIComponent(match[2]!) };
  } catch {
    return null;
  }
}

export const isStoredDocFileSrc = (src: string) =>
  parseDocFileSrc(src) !== null;

/**
 * A file name that is safe on any disk and in a header: no path parts or
 * control characters, at most 120 characters, extension kept.
 */
export function cleanFileName(raw: string, fallback = "file"): string {
  const base = raw.split(/[/\\]/).pop() ?? "";
  const cleaned = base
    // oxlint-disable-next-line no-control-regex -- stripping them is the point
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!cleaned) return fallback;
  if (cleaned.length <= 120) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 12 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 120 - ext.length).trimEnd() + ext;
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "";
  if (bytes < 1000) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export type FileKind =
  | "pdf"
  | "image"
  | "audio"
  | "video"
  | "sheet"
  | "slides"
  | "doc"
  | "text"
  | "code"
  | "archive"
  | "file";

const KIND_BY_EXTENSION: Record<string, FileKind> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  heic: "image",
  bmp: "image",
  svg: "image",
  tif: "image",
  tiff: "image",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  ogg: "audio",
  flac: "audio",
  aac: "audio",
  opus: "audio",
  mp4: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  avi: "video",
  m4v: "video",
  csv: "sheet",
  tsv: "sheet",
  xls: "sheet",
  xlsx: "sheet",
  ods: "sheet",
  numbers: "sheet",
  ppt: "slides",
  pptx: "slides",
  key: "slides",
  odp: "slides",
  doc: "doc",
  docx: "doc",
  odt: "doc",
  rtf: "doc",
  pages: "doc",
  epub: "doc",
  txt: "text",
  md: "text",
  log: "text",
  json: "code",
  js: "code",
  ts: "code",
  py: "code",
  sql: "code",
  html: "code",
  css: "code",
  xml: "code",
  yaml: "code",
  yml: "code",
  sh: "code",
  ipynb: "code",
  zip: "archive",
  gz: "archive",
  tgz: "archive",
  tar: "archive",
  "7z": "archive",
  rar: "archive",
  bz2: "archive",
  xz: "archive",
};

export function fileKind(name: string, mime = ""): FileKind {
  const byExt = KIND_BY_EXTENSION[fileExtension(name)];
  if (byExt) return byExt;
  if (mime === "application/pdf") return "pdf";
  const top = mime.split("/")[0];
  if (top === "image" || top === "audio" || top === "video") return top;
  if (top === "text") return "text";
  return "file";
}
