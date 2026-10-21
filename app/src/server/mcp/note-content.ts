import { toMarkdown } from "~/lib/note-content/convert";
import { fromNoteMarkdown } from "~/lib/note-content/note-markdown";
import type { NoteDoc } from "~/lib/note-content/types";
import { readNoteContent } from "~/server/notes/note-store";

type StoredNote = { content?: unknown; html: string; markdown: string };

/** Markdown view of a note, derived from its blocks. */
export function noteToMarkdown(
  doc: StoredNote,
  opts: { withIds?: boolean } = {},
): string {
  return toMarkdown(readNoteContent(doc), opts);
}

/** Reads the notes_get markdown dialect: task lines, [[links]], #tags, embeds. */
export function contentFromMarkdown(markdown: string): NoteDoc {
  return fromNoteMarkdown(markdown);
}

/** Appends markdown as new blocks below the current ones, leaving them untouched. */
export function appendMarkdown(doc: StoredNote, addition: string): NoteDoc {
  return appendBlocks(readNoteContent(doc), addition);
}

export function appendBlocks(current: NoteDoc, addition: string): NoteDoc {
  const added = fromNoteMarkdown(addition);
  return {
    ...current,
    content: [...(current.content ?? []), ...(added.content ?? [])],
  };
}
