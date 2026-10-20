import { buildNoteExtensions } from "~/lib/note-content/schema";
import Emoji, { gitHubEmojis } from "@tiptap/extension-emoji";
import { Table } from "@tiptap/extension-table";
import { CustomCodeBlock } from "./CustomCodeBlock";
import { CustomImage } from "./CustomImage";
import { CustomTableRow } from "./CustomTableRow";
import { CustomTableHeader } from "./CustomTableHeader";
import { CustomTableCell } from "./CustomTableCell";
import { CsvPaste } from "./CsvPaste";
import { MarkdownPaste } from "./MarkdownPaste";
import { ListItemReorderShortcuts } from "./ListItemReorderShortcuts";
import { SelectionMarkShortcuts } from "./SelectionMarkShortcuts";
import { createEmojiSuggestion } from "./emojiSuggestion";
import { SlashCommands } from "./SlashCommands";
import { DeferredFocusEvents } from "./DeferredFocusEvents";

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
    DeferredFocusEvents,
    ...buildNoteExtensions({
      image: CustomImage.configure({ allowBase64: true }),
      emoji: Emoji.configure({
        emojis: gitHubEmojis,
        enableEmoticons: true,
        suggestion: createEmojiSuggestion(gitHubEmojis),
      }),
      codeBlock: CustomCodeBlock,
      table: Table.configure({
        resizable: true,
        lastColumnResizable: true,
        allowTableNodeSelection: true,
      }),
      tableRow: CustomTableRow,
      tableHeader: CustomTableHeader,
      tableCell: CustomTableCell,
    }),
    ListItemReorderShortcuts,
    SelectionMarkShortcuts,
    SlashCommands,
    CsvPaste.configure({ onPrompt: csvPrompt }),
    // MarkdownPaste will read prompt from registry; no need to pass here
    MarkdownPaste.configure({}),
  ];
}
