import {
  detectImageType,
  persistImageBuffer,
  resolveDocImageStorageDir,
  type PersistedImage,
} from "~/server/lib/inline-image-migration";
import { checkImageIntegrity } from "~/server/lib/image-integrity";
import { fetchPublicFile, PublicFetchError } from "~/server/lib/public-fetch";

// Shared by the editor's paste/drop upload route and the MCP connector: bytes
// land as content-addressed files served from /api/doc-images.

export const MAX_IMAGE_BYTES = 10_000_000;

/** Raster formats only: an SVG served from the app's origin can run script. */
const STORABLE = new Set(["png", "jpg", "gif", "webp", "avif", "heic", "bmp"]);

/** The caller sent something that cannot be stored as an image. */
export class ImageRejectedError extends Error {}

export type StoredImage = PersistedImage & {
  /** From the file's header; null when the format does not say. */
  width: number | null;
  height: number | null;
};

/** Checks the bytes are a whole raster image and stores them. */
export async function storeImageBytes(
  buffer: Buffer,
  label: string,
): Promise<StoredImage> {
  if (!buffer.length) throw new ImageRejectedError(`${label} is empty`);
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ImageRejectedError(
      `${label} is larger than ${MAX_IMAGE_BYTES / 1e6} MB`,
    );
  }
  // Sniff from the bytes alone; a declared type is not trusted.
  const kind = detectImageType(buffer, "");
  if (!STORABLE.has(kind.ext)) {
    throw new ImageRejectedError(
      `${label} is not a PNG, JPEG, GIF, WebP, AVIF, HEIC, or BMP image`,
    );
  }
  // A cut-off image is refused, so it never replaces a good one in a note.
  const check = checkImageIntegrity(buffer, kind.ext);
  if (!check.ok) throw new ImageRejectedError(`${label} ${check.problem}`);
  const stored = await persistImageBuffer(
    buffer,
    kind,
    resolveDocImageStorageDir(),
  );
  return { ...stored, width: check.width, height: check.height };
}

/** Downloads a public image and stores it; private networks are refused. */
export async function importImageFromUrl(url: string): Promise<{
  stored: StoredImage;
  bytes: number;
}> {
  let buffer: Buffer;
  try {
    buffer = (await fetchPublicFile(url, { maxBytes: MAX_IMAGE_BYTES })).buffer;
  } catch (error) {
    if (error instanceof PublicFetchError)
      throw new ImageRejectedError(error.message);
    throw error;
  }
  const stored = await storeImageBytes(buffer, `The image at ${url}`);
  return { stored, bytes: buffer.length };
}
