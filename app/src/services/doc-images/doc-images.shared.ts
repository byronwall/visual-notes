export const DOC_IMAGE_UPLOAD_URL = "/api/doc-images";

/** Mirrors the server's limit; the client shrinks larger images first. */
export const DOC_IMAGE_MAX_BYTES = 10_000_000;

export type DocImageUploadResult = {
  /** Root-relative path to store in the note, e.g. /api/doc-images/<hash>.png */
  src: string;
  mime: string;
  bytes: number;
};

/** True for a /api/doc-images path, relative or on any host. */
export function isStoredDocImageSrc(src: string): boolean {
  if (src.startsWith(`${DOC_IMAGE_UPLOAD_URL}/`)) return true;
  try {
    return new URL(src).pathname.startsWith(`${DOC_IMAGE_UPLOAD_URL}/`);
  } catch {
    return false;
  }
}
