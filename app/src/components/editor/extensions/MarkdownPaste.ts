import { Extension } from "@tiptap/core";
import { Plugin } from "prosemirror-state";
import {
  looksLikeMarkdown,
  normalizeMarkdownToHtml,
} from "~/server/lib/markdown";
import { insertContentOrText } from "../core/insertContentOrText";
import { getMarkdownPrompt } from "../core/promptRegistry";

type Choice = "formatted" | "text" | "cancel";
type Source = "paste" | "drop" | "file";

export const MarkdownPaste = Extension.create<{
  onPrompt?: (text: string, source: Source) => Promise<Choice>;
}>({
  name: "markdownPaste",
  addOptions() {
    return { onPrompt: undefined };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const ask = this.options.onPrompt ?? getMarkdownPrompt();

    const handleText = (text: string, source: Source) => {
      console.log(`[markdown] ${source} detected, len:`, text.length);

      if (!ask) {
        const html = normalizeMarkdownToHtml(text);
        editor.chain().focus().insertContent(html).run();
        return true;
      }

      void ask(text, source).then((choice) => {
        if (choice === "cancel") return;
        if (choice === "formatted") {
          const html = normalizeMarkdownToHtml(text);
          console.log("[markdown] inserting formatted HTML");
          editor.chain().focus().insertContent(html).run();
        } else {
          insertContentOrText(editor, null, text);
        }
      });
      return true;
    };

    const maybeHandleMarkdown = (dt: DataTransfer, source: Source) => {
      // Prefer explicit text/markdown if present
      const md = dt.getData("text/markdown");
      if (md && md.trim()) {
        return handleText(md, source);
      }
      // Fall back to plain text heuristic
      const plain = dt.getData("text/plain");
      if (plain && looksLikeMarkdown(plain)) {
        return handleText(plain, source);
      }
      return false;
    };

    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            const dt = event.clipboardData;
            if (!dt) return false;

            // Avoid interfering when rich HTML is present and user likely wants the HTML
            const hasHtml = !!dt.getData("text/html");
            const hasMd = !!dt.getData("text/markdown");
            const plain = dt.getData("text/plain");
            const looksMd = plain && looksLikeMarkdown(plain);

            if (hasMd || (!hasHtml && looksMd)) {
              event.preventDefault();
              return maybeHandleMarkdown(dt, "paste");
            }

            return false;
          },
          handleDrop(_view, event) {
            // Not commonly used for markdown; ignore to avoid unexpected prompts
            return false;
          },
        },
      }),
    ];
  },
});
