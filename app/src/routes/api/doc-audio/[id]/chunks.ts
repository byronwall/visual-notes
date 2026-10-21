import type { APIEvent } from "@solidjs/start/server";
import { appendDocAudioChunk } from "~/server/notes/doc-audio-chunks";

// Binary chunks stream here while recording; a server action would have to
// round-trip every chunk through its serializer.
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

export async function POST(event: APIEvent) {
  const id = String(event.params.id || "").trim();
  const url = new URL(event.request.url);
  const seq = Number(url.searchParams.get("seq"));
  const elapsedMs = Number(url.searchParams.get("elapsedMs") ?? 0);
  if (!id || !Number.isInteger(seq) || seq < 0 || !Number.isFinite(elapsedMs)) {
    return Response.json({ error: "Invalid chunk request" }, { status: 400 });
  }
  const chunk = new Uint8Array(await event.request.arrayBuffer());
  if (chunk.byteLength > MAX_CHUNK_BYTES) {
    return Response.json({ error: "Chunk too large" }, { status: 413 });
  }
  try {
    const result = await appendDocAudioChunk({
      id,
      seq,
      elapsedMs: Math.max(0, Math.round(elapsedMs)),
      chunk,
    });
    if (!result.ok) {
      return Response.json(
        { error: result.error, chunkCount: result.chunkCount },
        { status: result.status },
      );
    }
    return Response.json(result);
  } catch (e) {
    console.error("[doc-audio] chunk append failed", id, seq, e);
    return Response.json({ error: "Chunk append failed" }, { status: 500 });
  }
}
