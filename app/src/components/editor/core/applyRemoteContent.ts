import type { Editor, JSONContent } from "@tiptap/core";

export type RemoteApplyResult = "applied" | "unchanged" | "deferred";

/**
 * Brings the editor to `next` by replacing only the range that differs, so
 * the selection outside that range stays put and undo history is untouched.
 * When the change covers the cursor of a focused editor, nothing is applied
 * and "deferred" is returned so the caller can retry later.
 */
export function applyRemoteContent(
  editor: Editor,
  next: JSONContent,
  opts: { deferIfCursorInside?: boolean } = {},
): RemoteApplyResult {
  const { state } = editor;
  const nextDoc = state.schema.nodeFromJSON(next);
  const start = state.doc.content.findDiffStart(nextDoc.content);
  if (start === null) return "unchanged";
  const end = state.doc.content.findDiffEnd(nextDoc.content);
  let endA = end?.a ?? state.doc.content.size;
  let endB = end?.b ?? nextDoc.content.size;
  // findDiffEnd can overlap findDiffStart when the change is a repeat.
  const overlap = start - Math.min(endA, endB);
  if (overlap > 0) {
    endA += overlap;
    endB += overlap;
  }
  const { from, to } = state.selection;
  if (
    opts.deferIfCursorInside &&
    editor.isFocused &&
    to >= start &&
    from <= endA
  ) {
    return "deferred";
  }
  const tr = state.tr.replace(start, endA, nextDoc.slice(start, endB));
  tr.setMeta("addToHistory", false);
  // Not a local edit: don't mark the note dirty or trigger an autosave.
  tr.setMeta("preventUpdate", true);
  editor.view.dispatch(tr);
  return "applied";
}
