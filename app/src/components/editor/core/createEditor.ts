import { createTiptapEditor } from "solid-tiptap";
import type { Editor } from "@tiptap/core";
import { buildExtensions } from "../extensions/index";

export function createEditor(
  element: () => HTMLElement | undefined,
  initial: string,
  onPrompt: Parameters<typeof buildExtensions>[0]
) {
  return createTiptapEditor(() => ({
    element: element()!,
    extensions: buildExtensions(onPrompt),
    editorProps: {
      attributes: { class: "p-4 focus:outline-none prose max-w-full" },
    },
    content: initial,
  })) as unknown as () => Editor | null;
}
