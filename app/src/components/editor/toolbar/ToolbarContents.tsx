import type { Editor } from "@tiptap/core";
import { Control } from "./Control";
import { blocks, marks, listsBlocks, type Btn } from "./toolbarConfig";
import { exec } from "../core/exec";
import { csvTextToTableJson } from "../csv/csvUtils";
import { insertContentOrText } from "../core/insertContentOrText";
import { Separator } from "../ui/Separator";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";
import { Box, HStack } from "styled-system/jsx";
import {
  ClipboardPasteIcon,
  Columns2Icon,
  FileCode2Icon,
  FileSpreadsheetIcon,
  Rows3Icon,
  TableColumnsSplitIcon,
  TableIcon,
  TableRowsSplitIcon,
  Trash2Icon,
} from "lucide-solid";

export function ToolbarContents(props: { editor: Editor }) {
  let csvInputRef: HTMLInputElement | undefined;

  const run = (fn: Btn["run"]) => exec(props.editor, fn);
  const renderControl = (b: Btn) => {
    const Icon = b.icon;
    if (Icon) {
      return (
        <Box
          as="span"
          w="full"
          h="full"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={16} />
        </Box>
      );
    }
    return (
      <Box as="span" w="full" h="full" m="1" {...b.labelStyle}>
        {b.label}
      </Box>
    );
  };

  const onCsvFileChange = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    console.log("[csv] importing file:", file.name);
    const text = await file.text();
    insertContentOrText(props.editor, csvTextToTableJson(text), text);
    input.value = "";
  };

  const onForceCsvPasteFromClipboard = async () => {
    const text = await navigator.clipboard.readText();
    console.log("[csv] force paste from clipboard, len:", text?.length ?? 0);
    if (!text) return;
    insertContentOrText(props.editor, csvTextToTableJson(text), text);
  };

  const onForceMarkdownPasteFromClipboard = async () => {
    const text = await navigator.clipboard.readText();
    console.log(
      "[markdown] force paste from clipboard, len:",
      text?.length ?? 0
    );
    if (!text) return;
    const html = normalizeMarkdownToHtml(text);
    props.editor.chain().focus().insertContent(html).run();
  };

  return (
    <HStack gap="1" p="2">
      <input
        ref={(el) => (csvInputRef = el)}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={onCsvFileChange}
      />

      <HStack gap="1">
        {blocks.map((b) => (
          <Control
            name={b.name}
            editor={props.editor}
            onChange={() => run(b.run)}
            title={b.title}
            isActive={b.isActive}
          >
            {renderControl(b)}
          </Control>
        ))}
      </HStack>

      <Separator />

      <HStack gap="1">
        {marks.map((b) => (
          <Control
            name={b.name}
            editor={props.editor}
            onChange={() => run(b.run)}
            title={b.title}
          >
            {renderControl(b)}
          </Control>
        ))}
      </HStack>

      <Separator />

      <HStack gap="1">
        {listsBlocks.map((b) => (
          <Control
            name={b.name}
            editor={props.editor}
            onChange={() => run(b.run)}
            title={b.title}
          >
            {renderControl(b)}
          </Control>
        ))}
      </HStack>

      <Separator />

      <HStack gap="1">
        <Control
          name="table"
          editor={props.editor}
          title="Insert Table"
          onChange={() =>
            run((ch) => {
              // TODO:AS_ANY, table chain commands come from table extension
              (ch as unknown as any).insertTable({
                rows: 3,
                cols: 3,
                withHeaderRow: true,
              });
              return ch;
            })
          }
        >
          <Box
            as="span"
            w="full"
            h="full"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
          >
            <TableIcon size={16} />
          </Box>
        </Control>
        <Control
          name="table"
          editor={props.editor}
          title="Import CSV as Table"
          onChange={() => csvInputRef?.click()}
        >
          <Box
            as="span"
            w="full"
            h="full"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
          >
            <FileSpreadsheetIcon size={16} />
          </Box>
        </Control>
        <Control
          name="table"
          editor={props.editor}
          title="Add Row"
          onChange={() =>
            run((ch) => {
              // TODO:AS_ANY, table chain commands come from table extension
              (ch as unknown as any).addRowAfter();
              return ch;
            })
          }
        >
          <Box
            as="span"
            w="full"
            h="full"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
          >
            <TableRowsSplitIcon size={16} />
          </Box>
        </Control>
        <Control
          name="table"
          editor={props.editor}
          title="Add Column"
          onChange={() =>
            run((ch) => {
              // TODO:AS_ANY, table chain commands come from table extension
              (ch as unknown as any).addColumnAfter();
              return ch;
            })
          }
        >
          <Box
            as="span"
            w="full"
            h="full"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
          >
            <TableColumnsSplitIcon size={16} />
          </Box>
        </Control>
        <Control
          name="table"
          editor={props.editor}
          title="Delete Row"
          onChange={() =>
            run((ch) => {
              // TODO:AS_ANY, table chain commands come from table extension
              (ch as unknown as any).deleteRow();
              return ch;
            })
          }
        >
          <Box
            as="span"
            w="full"
            h="full"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
          >
            <Rows3Icon size={16} />
          </Box>
        </Control>
        <Control
          name="table"
          editor={props.editor}
          title="Delete Column"
          onChange={() =>
            run((ch) => {
              // TODO:AS_ANY, table chain commands come from table extension
              (ch as unknown as any).deleteColumn();
              return ch;
            })
          }
        >
          <Box
            as="span"
            w="full"
            h="full"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
          >
            <Columns2Icon size={16} />
          </Box>
        </Control>
        <Control
          name="table"
          editor={props.editor}
          title="Delete Table"
          onChange={() =>
            run((ch) => {
              // TODO:AS_ANY, table chain commands come from table extension
              (ch as unknown as any).deleteTable();
              return ch;
            })
          }
        >
          <Box
            as="span"
            w="full"
            h="full"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
          >
            <Trash2Icon size={16} />
          </Box>
        </Control>
        <Control
          name="forceCsvPaste"
          editor={props.editor}
          title="Paste Clipboard as Table (CSV/TSV)"
          onChange={onForceCsvPasteFromClipboard}
        >
          <Box
            as="span"
            w="full"
            h="full"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
          >
            <ClipboardPasteIcon size={16} />
          </Box>
        </Control>
        <Control
          name="forceMarkdownPaste"
          editor={props.editor}
          title="Paste Clipboard as Markdown"
          onChange={onForceMarkdownPasteFromClipboard}
        >
          <Box
            as="span"
            w="full"
            h="full"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
          >
            <FileCode2Icon size={16} />
          </Box>
        </Control>
      </HStack>
    </HStack>
  );
}
