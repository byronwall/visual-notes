import { isStoredDocImageSrc } from "~/services/doc-images/doc-images.shared";

// Decides what a paste or drop carries. Sources disagree on shape:
// - screenshots and Finder copies put only an image file on the clipboard
// - "Copy image" in a browser adds `<img src=…>` HTML pointing at the site
// - copying a page selection (ChatGPT, docs, articles) gives HTML whose
//   images live on that site, often behind a login or a short-lived signature
// Image files win unless the HTML carries text worth keeping; HTML images
// are then copied into the app's own storage after the paste lands.

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|heic|heif|bmp|tiff?|svg)$/i;

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  // Some sources (Finder drags of HEIC, older Firefox) leave type empty.
  return file.type === "" && IMAGE_EXT.test(file.name);
}

/** Image files from a DataTransfer, read from both `files` and `items`. */
export function imageFilesFromTransfer(dt: DataTransfer): File[] {
  const found: File[] = [];
  const seen = new Set<string>();
  const add = (file: File | null) => {
    if (!file || !isImageFile(file)) return;
    const key = `${file.name}|${file.size}|${file.type}|${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(file);
  };
  for (const file of Array.from(dt.files ?? [])) add(file);
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === "file") add(item.getAsFile());
  }
  return found;
}

/** True when HTML holds nothing but images (and whitespace or wrappers). */
export function htmlIsOnlyImages(html: string): boolean {
  const text = html
    .replace(/<(style|script|head|title)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .trim();
  return text.length === 0;
}

/**
 * Image files to upload for this transfer, or null to let the editor's normal
 * HTML/text handling run (pasted HTML images are imported afterwards).
 */
export function pickImageFilesToUpload(dt: DataTransfer): File[] | null {
  const files = imageFilesFromTransfer(dt);
  if (files.length === 0) return null;
  const html = dt.getData("text/html");
  if (html && !htmlIsOnlyImages(html)) return null;
  return files;
}

/** This page's origin; undefined during SSR and in tests. */
export const currentOrigin = () =>
  typeof window === "undefined" ? undefined : window.location.origin;

export type ImportableSrc = "data" | "blob" | "remote";

/**
 * How an image src in the note must be brought into storage, or null when it
 * is already stored (or is a relative path the app serves itself).
 */
export function importableImageSrc(
  src: string,
  origin: string | undefined,
): ImportableSrc | null {
  const value = src.trim();
  if (!value) return null;
  if (/^data:image\//i.test(value)) return "data";
  if (value.startsWith("blob:")) return "blob";
  if (!/^https?:\/\//i.test(value)) return null;
  if (isStoredDocImageSrc(value)) {
    // Another deployment's stored image still needs copying here.
    try {
      if (!origin || new URL(value).origin === origin) return null;
    } catch {
      return null;
    }
  }
  return "remote";
}

/** Host name for messages, e.g. "chatgpt.com"; "" for non-URL sources. */
export function imageSourceHost(src: string): string {
  try {
    const url = new URL(src);
    return url.protocol.startsWith("http")
      ? url.hostname.replace(/^www\./, "")
      : "";
  } catch {
    return "";
  }
}
