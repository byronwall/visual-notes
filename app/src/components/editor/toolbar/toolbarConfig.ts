import type { Editor } from "@tiptap/core";
import type { LucideIcon } from "lucide-solid";
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
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
};

export const blocks: Btn[] = [
  {
    name: "paragraph",
    title: "Paragraph",
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
];

export const marks: Btn[] = [
  {
    name: "bold",
    title: "Bold",
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
    title: "Strike Through",
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
    name: "code",
    title: "Code",
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
    title: "Bullet List",
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
    title: "Ordered List",
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
    title: "Blockquote",
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
    title: "Code Block",
    label: "{ }",
    icon: SquareCodeIcon,
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).toggleCodeBlock();
      return ch;
    },
  },
];
