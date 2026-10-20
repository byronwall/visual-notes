import type { Prisma } from "@prisma/client";
import {
  contentFromLegacy,
  fromHtml,
  fromMarkdown,
  legacyColumns,
  normalizeNoteDoc,
  toHtml,
  toMarkdown,
  toPlainText,
} from "~/lib/note-content/convert";
import { NOTE_SCHEMA_VERSION } from "~/lib/note-content/schema";
import type { NoteDoc } from "~/lib/note-content/types";

/**
 * Server-side home for note bodies. Blocks (`Doc.content`) are canonical; the
 * legacy `html`/`markdown` columns are derived on every write until the
 * cutover is confirmed, so any reader not yet moved to blocks keeps working.
 */

export type ContentInput = {
  content?: unknown;
  markdown?: string;
  html?: string;
};

export const hasContentInput = (input: ContentInput) =>
  input.content !== undefined ||
  input.markdown !== undefined ||
  input.html !== undefined;

/** Normalizes any accepted input shape into validated blocks. */
export function prepareContent(input: ContentInput): NoteDoc {
  if (input.content !== undefined) return normalizeNoteDoc(input.content);
  if (input.html !== undefined) return fromHtml(input.html);
  return fromMarkdown(input.markdown ?? "");
}

/** Column values for a content write (version bump handled by callers). */
export function contentColumns(doc: NoteDoc) {
  return {
    content: doc as unknown as Prisma.InputJsonValue,
    contentSchemaVersion: NOTE_SCHEMA_VERSION,
    ...legacyColumns(doc),
  };
}

/**
 * `NOTE_CONTENT_READ=legacy` reads the old string columns instead of blocks.
 * It is the rollback switch while the legacy columns are still dual-written.
 */
export const readsLegacyContent = () =>
  process.env.NOTE_CONTENT_READ === "legacy";

/** The blocks to show for a stored row, honoring the read switch. */
export function readNoteContent(row: {
  content?: unknown;
  html?: string | null;
  markdown?: string | null;
}): NoteDoc {
  if (readsLegacyContent()) {
    return contentFromLegacy({ html: row.html, markdown: row.markdown });
  }
  return contentFromLegacy(row);
}

/** Fields captured in a revision snapshot of the current row. */
export function revisionSnapshot(row: {
  title: string;
  path: string | null;
  markdown: string;
  html: string;
  content?: unknown;
}) {
  return {
    title: row.title,
    path: row.path,
    markdown: row.markdown,
    html: row.html,
    content: (row.content ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

type StoredBody = {
  content?: unknown;
  html?: string | null;
  markdown?: string | null;
};

/** Plain text of a stored note (search, previews, embeddings). */
export const noteText = (row: StoredBody) => toPlainText(readNoteContent(row));

/** Markdown view of a stored note; headings survive for chunking. */
export const noteMarkdown = (row: StoredBody) =>
  toMarkdown(readNoteContent(row));

/** Rendered HTML of a stored note (share page, read-only views). */
export const noteHtml = (row: StoredBody) => toHtml(readNoteContent(row));
