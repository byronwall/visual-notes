import type { APIEvent } from "@solidjs/start/server";
import {
  AudioImportError,
  importDocAudio,
} from "~/server/notes/doc-audio-import";
import { AudioTooLargeError } from "~/server/notes/doc-audio-storage";
import { toDocAudioSummary } from "~/services/doc-audio/doc-audio.queries";
import { DOC_AUDIO_UPLOAD_MAX_BYTES } from "~/services/doc-audio/doc-audio.shared";

// A dropped recording posts its raw bytes here. The note id, file name
// (URI-encoded), modified time, and duration ride in the query string.

export async function POST(event: APIEvent) {
  const url = new URL(event.request.url);
  const docId = url.searchParams.get("docId")?.trim() ?? "";
  const name = url.searchParams.get("name")?.trim() ?? "";
  const modified = Number(url.searchParams.get("lastModified"));
  const durationMs = Number(url.searchParams.get("durationMs") ?? 0);
  const body = event.request.body;
  if (!docId || !name || !body) {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }
  const declared = Number(event.request.headers.get("content-length") ?? 0);
  if (declared > DOC_AUDIO_UPLOAD_MAX_BYTES) return tooLarge(name);
  try {
    const row = await importDocAudio({
      docId,
      name,
      type: event.request.headers.get("content-type") ?? "",
      recordedAt: modified > 0 ? new Date(modified) : null,
      durationMs: Number.isFinite(durationMs)
        ? Math.max(0, Math.round(durationMs))
        : 0,
      body,
    });
    return Response.json(toDocAudioSummary(row));
  } catch (error) {
    if (error instanceof AudioTooLargeError) return tooLarge(name);
    if (error instanceof AudioImportError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    console.error("[doc-audio] import failed", name, error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}

const tooLarge = (name: string) =>
  Response.json(
    {
      error: `${name} is larger than ${DOC_AUDIO_UPLOAD_MAX_BYTES / 1024 / 1024} MB`,
    },
    { status: 413 },
  );
