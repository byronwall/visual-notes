import type { Editor, Range } from "@tiptap/core";

export type SlashItem = {
  title: string;
  glyph: string;
  keywords: string[];
  shortcut?: string;
  run: (editor: Editor, range: Range) => void;
};

// TODO:AS_ANY, chain commands are augmented by extensions at runtime
type AnyChain = Record<string, (...args: unknown[]) => AnyChain> & {
  run: () => boolean;
};
const chainFor = (editor: Editor, range: Range) =>
  editor.chain().focus().deleteRange(range) as unknown as AnyChain;

export const SLASH_ITEMS: SlashItem[] = [
  {
    title: "Text",
    glyph: "¶",
    keywords: ["paragraph", "plain", "body"],
    shortcut: "Mod-Alt-0",
    run: (e, r) => chainFor(e, r).setParagraph().run(),
  },
  {
    title: "Heading 1",
    glyph: "H1",
    keywords: ["title", "h1", "large"],
    shortcut: "Mod-Alt-1",
    run: (e, r) => chainFor(e, r).setHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    glyph: "H2",
    keywords: ["section", "h2"],
    shortcut: "Mod-Alt-2",
    run: (e, r) => chainFor(e, r).setHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    glyph: "H3",
    keywords: ["subsection", "h3"],
    shortcut: "Mod-Alt-3",
    run: (e, r) => chainFor(e, r).setHeading({ level: 3 }).run(),
  },
  {
    title: "Bulleted list",
    glyph: "•",
    keywords: ["bullet", "unordered", "ul", "list"],
    shortcut: "Mod-Shift-8",
    run: (e, r) => chainFor(e, r).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    glyph: "1.",
    keywords: ["ordered", "ol", "number", "list"],
    shortcut: "Mod-Shift-7",
    run: (e, r) => chainFor(e, r).toggleOrderedList().run(),
  },
  {
    title: "Quote",
    glyph: "“",
    keywords: ["blockquote", "citation"],
    shortcut: "Mod-Shift-B",
    run: (e, r) => chainFor(e, r).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    glyph: "{}",
    keywords: ["code", "snippet", "pre"],
    shortcut: "Mod-Alt-C",
    run: (e, r) => chainFor(e, r).toggleCodeBlock().run(),
  },
  {
    title: "Table",
    glyph: "⊞",
    keywords: ["grid", "rows", "columns"],
    run: (e, r) =>
      chainFor(e, r)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: "Task",
    glyph: "☐",
    keywords: ["todo", "checkbox", "check", "task", "action"],
    run: (e, r) => chainFor(e, r).setNode("taskRef").run(),
  },
  {
    title: "Link to note",
    glyph: "[[",
    keywords: ["link", "note", "page", "reference", "mention"],
    run: (e, r) => chainFor(e, r).insertContent("[[").run(),
  },
  {
    title: "Copy link to block",
    glyph: "#",
    keywords: ["anchor", "permalink", "block", "share"],
    run: (e, r) => {
      chainFor(e, r).run();
      // Loaded on demand so this list stays free of UI imports.
      void import("../core/blockLinks").then((m) => m.copyBlockLink(e));
    },
  },
  {
    title: "Divider",
    glyph: "—",
    keywords: ["hr", "rule", "separator", "line"],
    run: (e, r) => chainFor(e, r).setHorizontalRule().run(),
  },
];

/** Prefix matches on the title rank above keyword matches. */
export function filterSlashItems(items: SlashItem[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const score = (item: SlashItem) => {
    const title = item.title.toLowerCase();
    if (title.startsWith(q)) return 0;
    if (title.split(" ").some((word) => word.startsWith(q))) return 1;
    if (item.keywords.some((k) => k.startsWith(q))) return 2;
    if (title.includes(q)) return 3;
    return 9;
  };
  return items
    .map((item) => ({ item, s: score(item) }))
    .filter(({ s }) => s < 9)
    .sort((a, b) => a.s - b.s)
    .map(({ item }) => item);
}
