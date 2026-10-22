import {
  DOC_IMAGE_UPLOAD_URL,
  type DocImageUploadResult,
} from "~/services/doc-images/doc-images.shared";
import { prepareImageForUpload } from "./prepareImage";

// Binary uploads go straight to the route (like audio chunks); a server
// action would serialize the bytes. Network blips and 5xx answers retry.

const RETRY_DELAYS_MS = [600, 1_800];

export class ImageUploadError extends Error {
  /** False when retrying cannot help (bad format, too large, refused url). */
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function post(init: RequestInit): Promise<DocImageUploadResult> {
  let lastError: ImageUploadError | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
    let response: Response;
    try {
      response = await fetch(DOC_IMAGE_UPLOAD_URL, { method: "POST", ...init });
    } catch {
      lastError = new ImageUploadError("Could not reach the server", true);
      continue;
    }
    const body = (await response.json().catch(() => ({}))) as Partial<
      DocImageUploadResult & { error: string }
    >;
    if (response.ok && body.src) return body as DocImageUploadResult;
    const message = body.error || `Upload failed (${response.status})`;
    lastError = new ImageUploadError(message, response.status >= 500);
    if (!lastError.retryable) break;
  }
  throw lastError ?? new ImageUploadError("Upload failed", true);
}

/** Converts/shrinks as needed, then stores the bytes. */
export async function uploadImageBlob(
  blob: Blob,
): Promise<DocImageUploadResult> {
  let prepared: Blob;
  try {
    prepared = await prepareImageForUpload(blob);
  } catch (error) {
    throw new ImageUploadError(
      error instanceof Error ? error.message : "Could not read the image",
      false,
    );
  }
  return post({
    body: prepared,
    headers: { "content-type": prepared.type || "application/octet-stream" },
  });
}

/** Asks the server to download a public image url and store it. */
export function importImageUrl(url: string): Promise<DocImageUploadResult> {
  return post({
    body: JSON.stringify({ url }),
    headers: { "content-type": "application/json" },
  });
}

/** Reads a data:/blob: url from this page into bytes and stores them. */
export async function uploadImageFromLocalUrl(
  url: string,
): Promise<DocImageUploadResult> {
  let blob: Blob;
  try {
    blob = await (await fetch(url)).blob();
  } catch {
    throw new ImageUploadError(
      "The pasted image data is no longer available",
      false,
    );
  }
  return uploadImageBlob(blob);
}
