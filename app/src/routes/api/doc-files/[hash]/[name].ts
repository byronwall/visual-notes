import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import type { APIEvent } from "@solidjs/start/server";
import {
  docFileHeaders,
  docFilePath,
  storedFileSize,
} from "~/server/lib/doc-file-store";
import { parseByteRange } from "~/server/notes/doc-audio-storage";

// Serves a note's file attachment. The path's name is the download name and
// picks the type (see docFileHeaders); `?download=1` always saves the file.
// Range requests are answered so PDFs and media can seek.

export async function GET(event: APIEvent) {
  const hash = String(event.params.hash || "");
  let name: string;
  try {
    name = decodeURIComponent(String(event.params.name || ""));
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const abs = docFilePath(hash);
  const size = abs && name ? await storedFileSize(hash) : null;
  if (!abs || size === null) return new Response("Not found", { status: 404 });

  const download = new URL(event.request.url).searchParams.has("download");
  const headers: Record<string, string> = {
    ...docFileHeaders(name, { download }),
    etag: `"${hash}"`,
  };
  if (event.request.headers.get("if-none-match") === `"${hash}"`) {
    return new Response(null, { status: 304, headers });
  }
  if (size === 0) {
    return new Response(new Uint8Array(0), {
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
  const stream = Readable.toWeb(
    createReadStream(abs, { start, end }),
  ) as ReadableStream<Uint8Array>;
  return new Response(stream, {
    status: range ? 206 : 200,
    headers: {
      ...headers,
      "content-length": String(end - start + 1),
      ...(range ? { "content-range": `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}
