import { Extension, type Editor } from "@tiptap/core";

function hasExpandedSelection(editor: Editor) {
  return !editor.state.selection.empty;
}

export const SelectionMarkShortcuts = Extension.create({
  name: "selectionMarkShortcuts",

  addKeyboardShortcuts() {
    return {
      "=": () => {
        if (!hasExpandedSelection(this.editor)) return false;
        return this.editor.chain().focus().toggleHighlight().run();
      },
      "`": () => {
        if (!hasExpandedSelection(this.editor)) return false;
        return this.editor.chain().focus().toggleCode().run();
      },
    };
  },
});
