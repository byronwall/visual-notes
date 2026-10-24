import type { EditorView } from "@tiptap/pm/view";

/**
 * Where an uploaded block (image, file) waits and lands: before an empty or
 * not-yet-typed line, after a finished one, or in a split of the line.
 * Inside a paragraph, the first insert would swallow the others' spot. A
 * drop's position is only roughly aimed, so it snaps to the nearer edge of
 * the line instead of splitting a word.
 */
export function blockAnchor(
  view: EditorView,
  pos: number,
  mode: "split" | "nearest",
): number {
  const anchor = lineAnchor(view, pos, mode);
  return anchor >= view.state.doc.content.size ? endAnchor(view) : anchor;
}

function lineAnchor(
  view: EditorView,
  pos: number,
  mode: "split" | "nearest",
): number {
  const $pos = view.state.doc.resolve(
    Math.min(pos, view.state.doc.content.size),
  );
  const parent = $pos.parent;
  if (!parent.isTextblock || $pos.depth === 0) return pos;
  const offset = $pos.parentOffset;
  const size = parent.content.size;
  if (size === 0 || offset === 0) return $pos.before();
  if (offset === size) return $pos.after();
  if (mode === "nearest") {
    return offset < size / 2 ? $pos.before() : $pos.after();
  }
  view.dispatch(view.state.tr.split(pos));
  return pos + 1;
}

/**
 * The end of the note: before a trailing empty line, adding one if needed.
 * Uploads that land after the last block would each get the editor's new
 * trailing line, leaving blank lines between them.
 */
function endAnchor(view: EditorView): number {
  const { doc, schema } = view.state;
  const last = doc.lastChild;
  if (last?.isTextblock && last.content.size === 0) {
    return doc.content.size - last.nodeSize;
  }
  const end = doc.content.size;
  view.dispatch(view.state.tr.insert(end, schema.nodes.paragraph!.create()));
  return end;
}
