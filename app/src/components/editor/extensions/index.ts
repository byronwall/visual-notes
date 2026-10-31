import { buildNoteExtensions } from "~/lib/note-content/schema";
import { Table } from "@tiptap/extension-table";
import { CustomCodeBlock } from "./CustomCodeBlock";
import { CustomImage } from "./CustomImage";
import { CustomTableRow } from "./CustomTableRow";
import { CustomTableHeader } from "./CustomTableHeader";
import { CustomTableCell } from "./CustomTableCell";
import { CsvPaste } from "./CsvPaste";
import { ImagePaste } from "./ImagePaste";
import { FilePaste } from "./FilePaste";
import { FileAttachmentNode } from "./FileAttachmentNode";
import { MarkdownPaste } from "./MarkdownPaste";
import { ListItemReorderShortcuts } from "./ListItemReorderShortcuts";
import { SelectionMarkShortcuts } from "./SelectionMarkShortcuts";
import { NoteEmoji } from "./NoteEmoji";
import { SlashCommands } from "./SlashCommands";
import { DeferredFocusEvents } from "./DeferredFocusEvents";
import { NoteLinkSuggestion } from "./NoteLinkSuggestion";
import { TaskRefEditor } from "./TaskRefView";
import { TagSuggestion } from "./TagSuggestion";
import {
  CollectionViewNode,
  type CollectionViewNodeOptions,
} from "./CollectionViewNode";

export function buildExtensions(
  csvPrompt: (
    text: string,
    src: "paste" | "drop" | "file",
  ) => Promise<"table" | "text" | "cancel">,
  _mdPrompt?: (
    text: string,
    src: "paste" | "drop" | "file",
  ) => Promise<"formatted" | "text" | "cancel">,
  embed?: Partial<CollectionViewNodeOptions>,
) {
  return [
    DeferredFocusEvents,
    ...buildNoteExtensions(NoteEmoji, {
      image: CustomImage.configure({ allowBase64: true }),
      codeBlock: CustomCodeBlock,
      table: Table.configure({
        resizable: true,
        lastColumnResizable: true,
        allowTableNodeSelection: true,
      }),
      tableRow: CustomTableRow,
      tableHeader: CustomTableHeader,
      tableCell: CustomTableCell,
      taskRef: TaskRefEditor,
      fileAttachment: FileAttachmentNode,
      collectionView: CollectionViewNode.configure({
        owner: embed?.owner ?? null,
        noteId: embed?.noteId,
      }),
    }),
    ListItemReorderShortcuts,
    SelectionMarkShortcuts,
    SlashCommands,
    NoteLinkSuggestion,
    TagSuggestion,
    FilePaste,
    ImagePaste,
    CsvPaste.configure({ onPrompt: csvPrompt }),
    // MarkdownPaste will read prompt from registry; no need to pass here
    MarkdownPaste.configure({}),
  ];
}
