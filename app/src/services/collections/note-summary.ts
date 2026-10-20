// The one place collection code reads note bodies. Cards need a cover image
// and a short preview; everything else about note content stays out of the
// collections feature. Bodies are read through the note store, so blocks are
// canonical and `NOTE_CONTENT_READ=legacy` rolls this reader back too.
import { prisma } from "~/server/db";
import { noteText, readNoteContent } from "~/server/notes/note-store";
import type { NoteDoc, NoteNode } from "~/lib/note-content/types";

export type NoteSummary = { coverUrl: string | null; preview: string };

const PREVIEW_LENGTH = 180;
/** Inline images larger than this are skipped as covers to keep payloads small. */
const MAX_INLINE_COVER = 300_000;

function firstImage(node: NoteNode): string | null {
  if (node.type === "image") {
    const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
    if (src && !(src.startsWith("data:") && src.length > MAX_INLINE_COVER)) return src;
  }
  for (const child of node.content ?? []) {
    const found = firstImage(child);
    if (found) return found;
  }
  return null;
}

/** Cover and preview for one note's blocks. */
export function summarizeDoc(doc: NoteDoc, text: string): NoteSummary {
  return {
    coverUrl: firstImage(doc),
    preview: text.replace(/\s+/g, " ").trim().slice(0, PREVIEW_LENGTH),
  };
}

/** Summary for a stored row (blocks, or legacy columns under the read switch). */
export function summarizeStoredNote(row: {
  content?: unknown;
  html?: string | null;
  markdown?: string | null;
}): NoteSummary {
  return summarizeDoc(readNoteContent(row), noteText(row));
}

/** Summaries for every row in a collection, keyed by note id. */
export async function summarizeCollectionNotes(
  collectionId: string,
): Promise<Record<string, NoteSummary>> {
  const docs = await prisma.doc.findMany({
    where: { collectionId },
    select: { id: true, content: true, html: true, markdown: true },
  });
  return Object.fromEntries(docs.map((d) => [d.id, summarizeStoredNote(d)]));
}
