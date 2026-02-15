import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Emoji, { gitHubEmojis } from "@tiptap/extension-emoji";
import { Table } from "@tiptap/extension-table";
import { CustomCode } from "./CustomCode";
import { CustomCodeBlock } from "./CustomCodeBlock";
import { CustomImage } from "./CustomImage";
import { CustomTableRow } from "./CustomTableRow";
import { CustomTableHeader } from "./CustomTableHeader";
import { CustomTableCell } from "./CustomTableCell";
import { CsvPaste } from "./CsvPaste";
import { MarkdownPaste } from "./MarkdownPaste";
import { ListItemReorderShortcuts } from "./ListItemReorderShortcuts";
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
    CustomTableRow,
    CustomTableHeader,
    CustomTableCell,
    ListItemReorderShortcuts,
    CsvPaste.configure({ onPrompt: csvPrompt }),
    // MarkdownPaste will read prompt from registry; no need to pass here
    MarkdownPaste.configure({}),
  ];
}
