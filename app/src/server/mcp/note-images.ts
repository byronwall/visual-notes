import {
  detectImageType,
  extractDataImageUrls,
  parseDataUrl,
  persistImageBuffer,
  replaceDataUrls,
  resolveDocImageStorageDir,
  type PersistedImage,
} from "~/server/lib/inline-image-migration";
import { fetchPublicFile, PublicFetchError } from "~/server/lib/public-fetch";
import { appLink, ConnectorError, type ConnectorContext } from "./shared";

// Images in agent-written notes. Bytes are stored like the app's own images
// (content-addressed files served from /api/doc-images), so a note never holds
// base64 and never depends on someone else's server staying up.

export const MAX_IMAGE_BYTES = 10_000_000;

/** Raster formats only: an SVG served from the app's origin can run script. */
const STORABLE = new Set(["png", "jpg", "gif", "webp", "avif", "heic", "bmp"]);

export type UploadedImage = {
  /** Full web address of the stored image. */
  url: string;
  /** What to put in markdown; the app stores image paths relative. */
  src: string;
  markdown: string;
  mime: string;
  bytes: number;
};

/** Checks the bytes are a raster image and stores them. */
async function storeImageBytes(
  buffer: Buffer,
  label: string,
): Promise<PersistedImage> {
  if (!buffer.length) throw new ConnectorError("invalid", `${label} is empty`);
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ConnectorError(
      "invalid",
      `${label} is larger than ${MAX_IMAGE_BYTES / 1e6} MB`,
    );
  }
  // Sniff from the bytes alone; a declared type is not trusted.
  const kind = detectImageType(buffer, "");
  if (!STORABLE.has(kind.ext)) {
    throw new ConnectorError(
      "invalid",
      `${label} is not a PNG, JPEG, GIF, WebP, AVIF, HEIC, or BMP image`,
    );
  }
  return persistImageBuffer(buffer, kind, resolveDocImageStorageDir());
}

function decodeData(data: string): Buffer {
  const trimmed = data.trim();
  if (trimmed.startsWith("data:")) {
    try {
      return parseDataUrl(trimmed).buffer;
    } catch {
      throw new ConnectorError("invalid", "data is not a valid data URL");
    }
  }
  if (!/^[A-Za-z0-9+/_\-\s]+=*\s*$/.test(trimmed)) {
    throw new ConnectorError("invalid", "data must be base64 or a data URL");
  }
  return Buffer.from(trimmed.replace(/\s+/g, ""), "base64");
}

const escapeAlt = (alt: string) => alt.replace(/[[\]\\]/g, "\\$&").trim();

export async function uploadImage(
  ctx: ConnectorContext,
  input: { data?: string; url?: string; alt?: string },
): Promise<UploadedImage> {
  if (!input.data === !input.url) {
    throw new ConnectorError("invalid", "Pass exactly one of data or url.");
  }
  let buffer: Buffer;
  if (input.data) {
    buffer = decodeData(input.data);
  } else {
    try {
      buffer = (await fetchPublicFile(input.url!, { maxBytes: MAX_IMAGE_BYTES }))
        .buffer;
    } catch (error) {
      if (error instanceof PublicFetchError)
        throw new ConnectorError("invalid", error.message);
      throw error;
    }
  }
  const label = input.url ? `The image at ${input.url}` : "data";
  const stored = await storeImageBytes(buffer, label);
  return {
    url: appLink(ctx, stored.publicUrl),
    src: stored.publicUrl,
    markdown: `![${escapeAlt(input.alt ?? "")}](${stored.publicUrl})`,
    mime: stored.mime,
    bytes: buffer.length,
  };
}

/**
 * Moves `data:image/...` sources in agent markdown into stored files, so the
 * note body keeps a short /api/doc-images path instead of the base64.
 */
export async function storeInlineImages(markdown: string): Promise<string> {
  const dataUrls = extractDataImageUrls(markdown);
  if (dataUrls.length === 0) return markdown;
  const replacements = new Map<string, string>();
  for (const [index, dataUrl] of dataUrls.entries()) {
    const stored = await storeImageBytes(
      decodeData(dataUrl),
      `Inline image ${index + 1}`,
    );
    replacements.set(dataUrl, stored.publicUrl);
  }
  return replaceDataUrls(markdown, replacements);
}
