import type { AnyExtension, Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Emoji, { gitHubEmojis } from "@tiptap/extension-emoji";
import Image from "@tiptap/extension-image";
import Code from "@tiptap/extension-code";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { createLowlight, common } from "lowlight";
import { BlockIds } from "./block-ids";
import { NoteLink } from "./note-link";
import { TaskRef } from "./task-ref";
import { Tag } from "./tag";

/**
 * The note document schema, with no UI imports. The editor layers its Solid
 * NodeViews and input helpers on top of these definitions; the server and
 * scripts use them as-is to validate, convert, and render notes. A node type
 * added here is understood everywhere.
 */

export const NOTE_SCHEMA_VERSION = 1;

export const DEFAULT_IMAGE_WIDTH_PERCENT = 100;

export function parseWidthPercent(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_IMAGE_WIDTH_PERCENT;
  return Math.min(100, Math.max(15, Math.round(parsed)));
}

const spellcheckAttr = {
  default: false,
  renderHTML: (attrs: { spellcheck?: boolean }) => ({
    spellcheck: attrs.spellcheck ? "true" : "false",
  }),
};

export const NoteImage = Image.extend({
  addAttributes() {
    // TODO:AS_ANY, extend base attrs; parent() is not well-typed in Tiptap's API
    const parent = (this as any).parent?.() ?? {};
    return {
      ...parent,
      widthPercent: {
        default: DEFAULT_IMAGE_WIDTH_PERCENT,
        parseHTML: (element: HTMLElement) => {
          const fromData = element.getAttribute("data-width");
          if (fromData) return parseWidthPercent(fromData);
          const styleWidth = element.style?.width || "";
          if (styleWidth.endsWith("%")) {
            return parseWidthPercent(styleWidth.slice(0, -1));
          }
          return DEFAULT_IMAGE_WIDTH_PERCENT;
        },
        renderHTML: (attrs: { widthPercent?: unknown }) => {
          const width = parseWidthPercent(attrs.widthPercent);
          return { "data-width": String(width), style: `width: ${width}%;` };
        },
      },
    } as any;
  },
});

export const NoteCode = Code.extend({
  addAttributes() {
    // TODO:AS_ANY, extend base attrs; parent() is not well-typed in Tiptap's API
    const parent = (this as any).parent?.() ?? {};
    return { ...parent, spellcheck: spellcheckAttr } as any;
  },
});

export const noteLowlight = createLowlight(common);

export const NoteCodeBlockBase = CodeBlockLowlight.extend({
  addAttributes() {
    // TODO:AS_ANY, extend base attrs; parent() is not well-typed in Tiptap's API
    const parent = (this as any).parent?.() ?? {};
    return { ...parent, spellcheck: spellcheckAttr } as any;
  },
});

/** Editor-only replacements for nodes that render through Solid NodeViews. */
export type NoteExtensionOverrides = {
  image?: AnyExtension;
  codeBlock?: AnyExtension;
  tableRow?: AnyExtension;
  tableHeader?: AnyExtension;
  tableCell?: AnyExtension;
  emoji?: AnyExtension;
  table?: AnyExtension;
  noteLink?: AnyExtension;
  taskRef?: AnyExtension;
};

export function buildNoteExtensions(
  overrides: NoteExtensionOverrides = {},
): Extensions {
  return [
    StarterKit.configure({ codeBlock: false, code: false }),
    Highlight.configure({}),
    overrides.image ?? NoteImage.configure({ allowBase64: true }),
    overrides.emoji ?? Emoji.configure({ emojis: gitHubEmojis }),
    NoteCode,
    overrides.codeBlock ??
      NoteCodeBlockBase.configure({ lowlight: noteLowlight }),
    overrides.table ?? Table,
    overrides.tableRow ?? TableRow,
    overrides.tableHeader ?? TableHeader,
    overrides.tableCell ?? TableCell,
    overrides.noteLink ?? NoteLink,
    overrides.taskRef ?? TaskRef,
    Tag,
    BlockIds,
  ];
}
