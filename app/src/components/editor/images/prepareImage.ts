import { DOC_IMAGE_MAX_BYTES } from "~/services/doc-images/doc-images.shared";

// Gets a pasted/dropped image into a shape the server stores: a raster format
// it accepts and under the size limit. TIFF (Safari/Preview copies) and SVG
// are redrawn as PNG; oversized images are re-encoded, then scaled down.

const STORED_AS_IS = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
]);

const MAX_EDGE_STEPS = [4096, 3072, 2048, 1600];

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This browser cannot read that image format"));
    };
    img.src = url;
  });
}

function encode(
  img: HTMLImageElement,
  maxEdge: number | null,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = maxEdge ? Math.min(1, maxEdge / Math.max(w, h)) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImageForUpload(blob: Blob): Promise<Blob> {
  const type = blob.type.toLowerCase();
  if (STORED_AS_IS.has(type) && blob.size <= DOC_IMAGE_MAX_BYTES) return blob;

  let img: HTMLImageElement;
  try {
    img = await loadImage(blob);
  } catch (error) {
    // Unknown/empty types (and HEIC outside Safari) may still be bytes the
    // server recognizes and converts.
    if (blob.size <= DOC_IMAGE_MAX_BYTES) return blob;
    throw error;
  }

  if (blob.size <= DOC_IMAGE_MAX_BYTES) {
    const png = await encode(img, null, "image/png");
    if (png && png.size <= DOC_IMAGE_MAX_BYTES) return png;
  }
  // Photos and huge screenshots: WebP keeps detail at a fraction of the size.
  for (const edge of [null, ...MAX_EDGE_STEPS]) {
    const out = await encode(img, edge, "image/webp", 0.9);
    // Browsers without WebP encoding hand back PNG; fall back to JPEG.
    const usable =
      out?.type === "image/webp"
        ? out
        : await encode(img, edge, "image/jpeg", 0.9);
    if (usable && usable.size <= DOC_IMAGE_MAX_BYTES) return usable;
  }
  throw new Error("The image is too large to store, even after shrinking it");
}

/** Pixel size of an image blob, for sizing the upload placeholder. */
export async function imageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number } | null> {
  try {
    const img = await loadImage(blob);
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}
