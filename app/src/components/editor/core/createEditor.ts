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
      attributes: { class: "prose editor-prose" },
    },
    content: initial,
  })) as unknown as () => Editor | null;
}

export function createEditorWithPrompts(
  element: () => HTMLElement | undefined,
  initial: string,
  onCsvPrompt: Parameters<typeof buildExtensions>[0],
  onMarkdownPrompt?: Parameters<typeof buildExtensions>[1]
) {
  return createTiptapEditor(() => ({
    element: element()!,
    extensions: buildExtensions(onCsvPrompt, onMarkdownPrompt),
    editorProps: {
      attributes: { class: "prose editor-prose" },
    },
    content: initial,
  })) as unknown as () => Editor | null;
}
