import type { Editor } from "@tiptap/core";

export type Chain = ReturnType<Editor["chain"]>;

export function exec(editor: Editor, fn: (chain: Chain) => Chain): boolean {
  const ch = editor.chain().focus();
  return fn(ch).run();
}
