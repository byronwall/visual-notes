import type { Editor } from "@tiptap/core";
import { For, Show, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { createEditorTransaction } from "solid-tiptap";
import { Control } from "./Control";
import {
  blocks,
  formatShortcut,
  marks,
  listsBlocks,
  type Btn,
} from "./toolbarConfig";
import { exec } from "../core/exec";
import { csvTextToTableJson } from "../csv/csvUtils";
import { insertContentOrText } from "../core/insertContentOrText";
import { Separator } from "../ui/Separator";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";
import { Tooltip } from "~/components/ui/tooltip";
import * as Menu from "~/components/ui/menu";
import { AIPromptsMenu } from "../ui/AIPromptsMenu";
import { Box, HStack } from "styled-system/jsx";
import {
  ClipboardPasteIcon,
  Columns2Icon,
  FileCode2Icon,
  FileSpreadsheetIcon,
  PlusIcon,
  Rows3Icon,
  TableColumnsSplitIcon,
  TableIcon,
  TableRowsSplitIcon,
  Trash2Icon,
} from "lucide-solid";
import { Toggle } from "./Toggle";

// TODO:AS_ANY, table chain commands come from the table extension at runtime
type TableChain = Record<string, (...args: unknown[]) => unknown>;
const tableCommand =
  (command: string, ...args: unknown[]) =>
  (ch: Parameters<Btn["run"]>[0]) => {
    (ch as unknown as TableChain)[command](...args);
    return ch;
  };

// Table tools only make sense with the caret inside a table, so they appear
// on demand instead of crowding the toolbar for every note.
const tableTools: Btn[] = [
  {
    name: "addRowAfter",
    title: "Add row below",
    label: "+R",
    icon: TableRowsSplitIcon,
    isActive: () => false,
    run: tableCommand("addRowAfter"),
  },
  {
    name: "addColumnAfter",
    title: "Add column right",
    label: "+C",
    icon: TableColumnsSplitIcon,
    isActive: () => false,
    run: tableCommand("addColumnAfter"),
  },
  {
    name: "deleteRow",
    title: "Delete row",
    label: "-R",
    icon: Rows3Icon,
    isActive: () => false,
    run: tableCommand("deleteRow"),
  },
  {
    name: "deleteColumn",
    title: "Delete column",
    label: "-C",
    icon: Columns2Icon,
    isActive: () => false,
    run: tableCommand("deleteColumn"),
  },
  {
    name: "deleteTable",
    title: "Delete table",
    label: "-T",
    icon: Trash2Icon,
    isActive: () => false,
    run: tableCommand("deleteTable"),
  },
];

function TooltipLabel(props: { title: string; shortcut?: string }) {
  return (
    <HStack gap="2" alignItems="center">
      <span>{props.title}</span>
      <Show when={props.shortcut}>
        {(shortcut) => (
          <Box as="span" opacity="0.7" fontFamily="mono" fontSize="xs">
            {formatShortcut(shortcut())}
          </Box>
        )}
      </Show>
    </HStack>
  );
}

function BtnIcon(props: { btn: Btn }) {
  return (
    <Show
      when={props.btn.icon}
      fallback={
        <Box as="span" m="1" {...props.btn.labelStyle}>
          {props.btn.label}
        </Box>
      }
    >
      {(icon) => <Dynamic component={icon()} size={16} />}
    </Show>
  );
}

function Group(props: { children: JSX.Element }) {
  return (
    <HStack gap="0.5" flexShrink="0" alignItems="center">
      {props.children}
    </HStack>
  );
}

export function ToolbarContents(props: {
  editor: Editor;
  noteId?: string;
  showAiPromptsMenu?: boolean;
}) {
  let csvInputRef: HTMLInputElement | undefined;

  const run = (fn: Btn["run"]) => exec(props.editor, fn);
  const inTable = createEditorTransaction(
    () => props.editor,
    (instance) => instance.isActive("table"),
  );

  const renderButtons = (list: Btn[]) => (
    <For each={list}>
      {(b) => (
        <Tooltip
          content={<TooltipLabel title={b.title} shortcut={b.shortcut} />}
          showArrow
          openDelay={300}
        >
          <Control
            name={b.name}
            editor={props.editor}
            onChange={() => run(b.run)}
            title=""
            ariaLabel={b.title}
            isActive={b.isActive}
          >
            <BtnIcon btn={b} />
          </Control>
        </Tooltip>
      )}
    </For>
  );

  const onCsvFileChange = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    const text = await file.text();
    insertContentOrText(props.editor, csvTextToTableJson(text), text);
    input.value = "";
  };

  const onForceCsvPasteFromClipboard = async () => {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    insertContentOrText(props.editor, csvTextToTableJson(text), text);
  };

  const onForceMarkdownPasteFromClipboard = async () => {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    const html = normalizeMarkdownToHtml(text);
    props.editor.chain().focus().insertContent(html).run();
  };

  const insertTable = () =>
    run(tableCommand("insertTable", { rows: 3, cols: 3, withHeaderRow: true }));

  return (
    <HStack
      gap="1"
      px="2"
      py="1.5"
      alignItems="center"
      flexWrap={{ base: "nowrap", md: "wrap" }}
      rowGap="1"
      overflowX={{ base: "auto", md: "visible" }}
      css={{
        scrollbarWidth: "none",
        // Fade the trailing edge on phones so the row reads as scrollable.
        maskImage: {
          base: "linear-gradient(to right, black calc(100% - 2rem), transparent)",
          md: "none",
        },
      }}
    >
      <input
        ref={(el) => (csvInputRef = el)}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={onCsvFileChange}
      />

      <Group>{renderButtons(blocks)}</Group>
      <Separator />
      <Group>{renderButtons(marks)}</Group>
      <Separator />
      <Group>{renderButtons(listsBlocks)}</Group>
      <Separator />
      <Group>
        <Tooltip content="Insert table" showArrow openDelay={300}>
          <Toggle ariaLabel="Insert table" onPress={insertTable}>
            <TableIcon size={16} />
          </Toggle>
        </Tooltip>
        <Menu.Root size="sm" positioning={{ placement: "bottom-start" }}>
          <Tooltip content="More ways to insert" showArrow openDelay={300}>
            <Menu.Trigger
              asChild={(triggerProps) => (
                <Toggle {...triggerProps} ariaLabel="More ways to insert">
                  <PlusIcon size={16} />
                </Toggle>
              )}
            />
          </Tooltip>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item value="csv-file" onSelect={() => csvInputRef?.click()}>
                <FileSpreadsheetIcon size={14} />
                Import CSV file as table
              </Menu.Item>
              <Menu.Item
                value="csv-paste"
                onSelect={() => void onForceCsvPasteFromClipboard()}
              >
                <ClipboardPasteIcon size={14} />
                Paste clipboard as table
              </Menu.Item>
              <Menu.Item
                value="md-paste"
                onSelect={() => void onForceMarkdownPasteFromClipboard()}
              >
                <FileCode2Icon size={14} />
                Paste clipboard as Markdown
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      </Group>
      <Show when={inTable()}>
        <Separator />
        <Group>{renderButtons(tableTools)}</Group>
      </Show>
      <Show when={props.showAiPromptsMenu}>
        <Box ml="auto" flexShrink="0" pl="1">
          <AIPromptsMenu editor={props.editor} noteId={props.noteId} />
        </Box>
      </Show>
    </HStack>
  );
}
