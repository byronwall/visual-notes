import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { CustomCode } from "./CustomCode";
import { CustomCodeBlock } from "./CustomCodeBlock";
import { CsvPaste } from "./CsvPaste";
import { MarkdownPaste } from "./MarkdownPaste";

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
    Image.configure({ allowBase64: true }),
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
