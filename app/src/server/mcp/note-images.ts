import {
  extractDataImageUrls,
  parseDataUrl,
  replaceDataUrls,
} from "~/server/lib/inline-image-migration";
import {
  importImageFromUrl,
  ImageRejectedError,
  storeImageBytes as storeRasterBytes,
  type StoredImage,
} from "~/server/lib/doc-image-store";
import { appLink, ConnectorError, type ConnectorContext } from "./shared";

// Images in agent-written notes. Bytes are stored like the app's own images
// (content-addressed files served from /api/doc-images), so a note never holds
// base64 and never depends on someone else's server staying up.

export { MAX_IMAGE_BYTES } from "~/server/lib/doc-image-store";

export type UploadedImage = {
  /** Full web address of the stored image. */
  url: string;
  /** What to put in markdown; the app stores image paths relative. */
  src: string;
  markdown: string;
  mime: string;
  bytes: number;
  /** Pixel size from the file's header, to check against what was intended. */
  width: number | null;
  height: number | null;
};

const asConnectorError = (error: unknown): never => {
  if (error instanceof ImageRejectedError)
    throw new ConnectorError("invalid", error.message);
  throw error;
};

/** Checks the bytes are a whole raster image and stores them. */
async function storeImageBytes(
  buffer: Buffer,
  label: string,
): Promise<StoredImage> {
  return storeRasterBytes(buffer, label).catch(asConnectorError);
}

export function decodeData(data: string): Buffer {
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
  let stored: StoredImage;
  let bytes: number;
  if (input.data) {
    const buffer = decodeData(input.data);
    stored = await storeImageBytes(buffer, "data");
    bytes = buffer.length;
  } else {
    ({ stored, bytes } = await importImageFromUrl(input.url!).catch(
      asConnectorError,
    ));
  }
  return {
    url: appLink(ctx, stored.publicUrl),
    src: stored.publicUrl,
    markdown: `![${escapeAlt(input.alt ?? "")}](${stored.publicUrl})`,
    mime: stored.mime,
    bytes,
    width: stored.width,
    height: stored.height,
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
