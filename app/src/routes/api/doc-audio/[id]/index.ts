import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import {
  audioFileSize,
  parseByteRange,
  readAudioRange,
} from "~/server/notes/doc-audio-storage";

// Safari will not play media from a server that ignores Range requests.
export async function GET(event: APIEvent) {
  const id = String(event.params.id || "").trim();
  const row = id
    ? await prisma.docAudio.findUnique({
        where: { id },
        select: { fileName: true, mimeType: true, status: true },
      })
    : null;
  if (!row) return new Response("Not found", { status: 404 });

  let size: number;
  try {
    size = await audioFileSize(row.fileName);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const headers: Record<string, string> = {
    "content-type": row.mimeType,
    "accept-ranges": "bytes",
    // A recording still in progress keeps growing.
    "cache-control":
      row.status === "ready"
        ? "private, max-age=31536000, immutable"
        : "no-store",
  };
  if (size === 0) {
    return new Response(new Uint8Array(0), {
      status: 200,
      headers: { ...headers, "content-length": "0" },
    });
  }

  const range = parseByteRange(event.request.headers.get("range"), size);
  if (range === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: { ...headers, "content-range": `bytes */${size}` },
    });
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  const body = await readAudioRange(row.fileName, start, end);
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      ...headers,
      "content-length": String(body.byteLength),
      ...(range ? { "content-range": `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}
