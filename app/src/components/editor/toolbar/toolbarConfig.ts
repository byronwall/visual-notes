import type { Editor } from "@tiptap/core";
import type { LucideIcon } from "lucide-solid";
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HighlighterIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  PilcrowIcon,
  QuoteIcon,
  SquareCodeIcon,
  StrikethroughIcon,
} from "lucide-solid";
import type { Chain } from "../core/exec";

export type Btn = {
  name: string;
  title: string;
  isActive?: (e: Editor) => boolean;
  run: (ch: Chain) => Chain;
  icon?: LucideIcon;
  labelStyle?: {
    fontWeight?: "regular" | "medium" | "semibold" | "bold";
    fontStyle?: "normal" | "italic";
    textDecoration?: "none" | "line-through";
  };
  label: string;
  /** Keyboard shortcut shown in the tooltip, in `Mod-Shift-x` form. */
  shortcut?: string;
};

export const blocks: Btn[] = [
  {
    name: "paragraph",
    title: "Paragraph",
    shortcut: "Mod-Alt-0",
    label: "P",
    icon: PilcrowIcon,
    labelStyle: { fontWeight: "semibold" },
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).setParagraph();
      return ch;
    },
  },
  {
    name: "heading",
    title: "Heading 1",
    shortcut: "Mod-Alt-1",
    label: "H1",
    icon: Heading1Icon,
    labelStyle: { fontWeight: "semibold" },
    isActive: (e) => e.isActive("heading", { level: 1 }),
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).setHeading({ level: 1 });
      return ch;
    },
  },
  {
    name: "heading",
    title: "Heading 2",
    shortcut: "Mod-Alt-2",
    label: "H2",
    icon: Heading2Icon,
    labelStyle: { fontWeight: "semibold" },
    isActive: (e) => e.isActive("heading", { level: 2 }),
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).setHeading({ level: 2 });
      return ch;
    },
  },
  {
    name: "heading",
    title: "Heading 3",
    shortcut: "Mod-Alt-3",
    label: "H3",
    icon: Heading3Icon,
    labelStyle: { fontWeight: "semibold" },
    isActive: (e) => e.isActive("heading", { level: 3 }),
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).setHeading({ level: 3 });
      return ch;
    },
  },
];

const isMac = () =>
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

/** Formats `Mod-Shift-b` as `⌘⇧B` on macOS and `Ctrl+Shift+B` elsewhere. */
export function formatShortcut(shortcut: string) {
  const mac = isMac();
  const parts = shortcut.split("-").map((part) => {
    if (part === "Mod") return mac ? "⌘" : "Ctrl";
    if (part === "Shift") return mac ? "⇧" : "Shift";
    if (part === "Alt") return mac ? "⌥" : "Alt";
    return part.toUpperCase();
  });
  return mac ? parts.join("") : parts.join("+");
}

export const marks: Btn[] = [
  {
    name: "bold",
    title: "Bold",
    shortcut: "Mod-B",
    label: "B",
    icon: BoldIcon,
    labelStyle: { fontWeight: "semibold" },
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).toggleBold();
      return ch;
    },
  },
  {
    name: "italic",
    title: "Italic",
    shortcut: "Mod-I",
    label: "I",
    icon: ItalicIcon,
    labelStyle: { fontStyle: "italic" },
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).toggleItalic();
      return ch;
    },
  },
  {
    name: "strike",
    title: "Strikethrough",
    shortcut: "Mod-Shift-S",
    label: "S",
    icon: StrikethroughIcon,
    labelStyle: { textDecoration: "line-through" },
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).toggleStrike();
      return ch;
    },
  },
  {
    name: "highlight",
    title: "Highlight",
    shortcut: "Mod-Shift-H",
    label: "HL",
    icon: HighlighterIcon,
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).toggleHighlight();
      return ch;
    },
  },
  {
    name: "code",
    title: "Inline code",
    shortcut: "Mod-E",
    label: "</>",
    icon: CodeIcon,
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).toggleCode();
      return ch;
    },
  },
];

export const listsBlocks: Btn[] = [
  {
    name: "bulletList",
    title: "Bulleted list",
    shortcut: "Mod-Shift-8",
    label: "••",
    icon: ListIcon,
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).toggleBulletList();
      return ch;
    },
  },
  {
    name: "orderedList",
    title: "Numbered list",
    shortcut: "Mod-Shift-7",
    label: "1.",
    icon: ListOrderedIcon,
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).toggleOrderedList();
      return ch;
    },
  },
  {
    name: "blockquote",
    title: "Quote",
    shortcut: "Mod-Shift-B",
    label: "“",
    icon: QuoteIcon,
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).toggleBlockquote();
      return ch;
    },
  },
  {
    name: "codeBlock",
    title: "Code block",
    shortcut: "Mod-Alt-C",
    label: "{ }",
    icon: SquareCodeIcon,
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).toggleCodeBlock();
      return ch;
    },
  },
];
