import type { Editor } from "@tiptap/core";
import type { Chain } from "../core/exec";

export type Btn = {
  name: string;
  title: string;
  isActive?: (e: Editor) => boolean;
  run: (ch: Chain) => Chain;
  class?: string;
  label: string;
};

export const blocks: Btn[] = [
  {
    name: "paragraph",
    title: "Paragraph",
    label: "P",
    class: "font-bold",
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
    class: "font-bold",
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
    class: "font-bold",
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
    class: "font-bold",
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
    class: "italic",
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
    class: "line-through",
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
    run: (ch) => {
      // TODO:AS_ANY, chain commands are augmented by extensions at runtime
      (ch as unknown as any).toggleCodeBlock();
      return ch;
    },
  },
];
