import type { Editor, JSONContent } from "@tiptap/core";

export function insertContentOrText(
  editor: Editor,
  json: JSONContent | null,
  text: string
) {
  // TODO:AS_ANY, Tiptap Editor hides ProseMirror view/state; direct access required for plain text insert
  const view = (editor as any).view as {
    state: any;
    dispatch: (tr: any) => void;
  };
  if (json) {
    editor.chain().focus().insertContent(json).run();
    return;
  }
  view.dispatch(view.state.tr.insertText(text));
}
