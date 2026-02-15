import { Extension, type Editor } from "@tiptap/core";
import { TextSelection } from "prosemirror-state";

type Direction = "up" | "down";
// TODO:AS_ANY, ProseMirror Node types are not directly exported in this workspace setup.
type PMNode = any;

function findListItemContext(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name !== "listItem") continue;
    if (depth < 1) return null;
    return {
      listItemDepth: depth,
      listDepth: depth - 1,
    };
  }
  return null;
}

function childStartPos(listPos: number, listNode: PMNode, index: number) {
  let pos = listPos + 1;
  for (let i = 0; i < index; i += 1) {
    pos += listNode.child(i).nodeSize;
  }
  return pos;
}

function moveCurrentListItem(editor: Editor, direction: Direction): boolean {
  const context = findListItemContext(editor);
  if (!context) return false;

  const { $from } = editor.state.selection;
  const listNode = $from.node(context.listDepth);
  const listPos = $from.before(context.listDepth);
  const currentIndex = $from.index(context.listDepth);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= listNode.childCount) return false;

  const children = Array.from(
    { length: listNode.childCount },
    (_, index) => listNode.child(index),
  );
  [children[currentIndex], children[targetIndex]] = [
    children[targetIndex],
    children[currentIndex],
  ];

  const nextListNode = listNode.type.create(listNode.attrs, children, listNode.marks);
  const tr = editor.state.tr;
  tr.replaceWith(listPos, listPos + listNode.nodeSize, nextListNode);

  const currentItemStart = $from.before(context.listItemDepth);
  const offsetInsideItem = Math.max(1, $from.pos - currentItemStart);
  const movedItemPos = childStartPos(listPos, nextListNode, targetIndex);
  const movedItemNode = nextListNode.child(targetIndex);
  const maxOffset = Math.max(1, movedItemNode.nodeSize - 2);
  const nextPos = movedItemPos + Math.min(offsetInsideItem, maxOffset);
  tr.setSelection(TextSelection.near(tr.doc.resolve(nextPos)));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export const ListItemReorderShortcuts = Extension.create({
  name: "listItemReorderShortcuts",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      "Alt-Shift-ArrowUp": () => moveCurrentListItem(this.editor, "up"),
      "Alt-Shift-ArrowDown": () => moveCurrentListItem(this.editor, "down"),
    };
  },
});
