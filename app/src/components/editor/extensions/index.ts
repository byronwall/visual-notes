import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { CustomCode } from "./CustomCode";
import { CustomCodeBlock } from "./CustomCodeBlock";
import { CsvPaste } from "./CsvPaste";

export function buildExtensions(
  prompt: (text: string, src: "paste" | "drop" | "file") => Promise<"table" | "text" | "cancel">
) {
  return [
    StarterKit.configure({ codeBlock: false, code: false }),
    Image.configure({ allowBase64: true }),
    CustomCode,
    CustomCodeBlock,
    Table.configure({ resizable: true, lastColumnResizable: true, allowTableNodeSelection: true }),
    TableRow,
    TableHeader,
    TableCell,
    CsvPaste.configure({ onPrompt: prompt }),
  ];
}


