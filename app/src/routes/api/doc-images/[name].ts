import { readFile } from "node:fs/promises";
import path from "node:path";
import type { APIEvent } from "@solidjs/start/server";
import {
  contentTypeForDocImageName,
  ensureJpegForHeicFile,
  isValidDocImageName,
} from "~/server/lib/inline-image-migration";

const DEFAULT_STORAGE_DIR = path.resolve(process.cwd(), "data", "doc-images");

function getStorageDir() {
  const fromEnv = process.env.DOC_IMAGE_STORAGE_DIR?.trim();
  return fromEnv ? path.resolve(fromEnv) : DEFAULT_STORAGE_DIR;
}

export async function GET(event: APIEvent) {
  const name = String(event.params.name || "").trim();
  if (!name || !isValidDocImageName(name)) {
    return new Response("Not found", { status: 404 });
  }

  const storageDir = getStorageDir();
  const absPath = path.resolve(storageDir, name);
  const prefix = `${storageDir}${path.sep}`;
  if (!absPath.startsWith(prefix)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    let targetName = name;
    if (name.toLowerCase().endsWith(".heic")) {
      try {
        const jpeg = await ensureJpegForHeicFile(storageDir, name);
        targetName = jpeg.fileName;
      } catch (e) {
        console.log("[doc-images] HEIC transcode fallback failed:", e);
      }
    }

    const targetPath = path.resolve(storageDir, targetName);
    if (!targetPath.startsWith(prefix)) {
      return new Response("Not found", { status: 404 });
    }

    const payload = await readFile(targetPath);
    // Response BodyInit in this environment expects Uint8Array, not Node Buffer.
    return new Response(new Uint8Array(payload), {
      status: 200,
      headers: {
        "content-type": contentTypeForDocImageName(targetName),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
