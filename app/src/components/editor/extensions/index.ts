import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Emoji, { gitHubEmojis } from "@tiptap/extension-emoji";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { CustomCode } from "./CustomCode";
import { CustomCodeBlock } from "./CustomCodeBlock";
import { CustomImage } from "./CustomImage";
import { CsvPaste } from "./CsvPaste";
import { MarkdownPaste } from "./MarkdownPaste";
import { createEmojiSuggestion } from "./emojiSuggestion";

export function buildExtensions(
  csvPrompt: (
    text: string,
    src: "paste" | "drop" | "file"
  ) => Promise<"table" | "text" | "cancel">,
  _mdPrompt?: (
    text: string,
    src: "paste" | "drop" | "file"
  ) => Promise<"formatted" | "text" | "cancel">
) {
  return [
    StarterKit.configure({ codeBlock: false, code: false }),
    Highlight.configure({}),
    CustomImage.configure({ allowBase64: true }),
    Emoji.configure({
      emojis: gitHubEmojis,
      enableEmoticons: true,
      suggestion: createEmojiSuggestion(gitHubEmojis),
    }),
    CustomCode,
    CustomCodeBlock,
    Table.configure({
      resizable: true,
      lastColumnResizable: true,
      allowTableNodeSelection: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    CsvPaste.configure({ onPrompt: csvPrompt }),
    // MarkdownPaste will read prompt from registry; no need to pass here
    MarkdownPaste.configure({}),
  ];
}
