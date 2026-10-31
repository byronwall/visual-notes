import type { JSONContent } from "@tiptap/core";

const MAX_TITLE_CHARS = 80;

const isEmptyH1 = (node: JSONContent) =>
  node.type === "heading" && node.attrs?.level === 1 && !firstLine(node);

// The first run of text in a block, stopping at a hard break.
const firstLine = (node: JSONContent): string => {
  let line = "";
  for (const child of node.content ?? []) {
    if (child.type === "hardBreak") break;
    if (child.content) {
      const nested = firstLine(child);
      if (nested.trim()) return nested;
    }
    line += child.text ?? "";
  }
  return line.replace(/\s+/g, " ").trim();
};

const clip = (line: string) => {
  if (line.length <= MAX_TITLE_CHARS) return line;
  const cut = line.slice(0, MAX_TITLE_CHARS);
  return `${cut.slice(0, cut.lastIndexOf(" ") + 1 || undefined).trim()}…`;
};

/**
 * A new note can start with an empty H1, because a click below the heading
 * puts the caret in the body. Then the first line of text is the title. A short
 * first paragraph becomes the H1, so the note page shows one title line. Other
 * text stays in the body, and the empty H1 goes.
 */
export const titleFromFirstLine = (
  doc: JSONContent,
): { title?: string; content: JSONContent } => {
  const [first, ...rest] = doc.content ?? [];
  if (!first || !isEmptyH1(first)) return { content: doc };

  const start = rest.findIndex((block) => firstLine(block));
  if (start === -1) {
    return {
      content: {
        ...doc,
        content: rest.length ? rest : [{ type: "paragraph" }],
      },
    };
  }

  const body = rest[start];
  const line = firstLine(body);
  const title = clip(line);
  const wholeBlock =
    body.type === "paragraph" &&
    title === line &&
    !body.content?.some((child) => child.type === "hardBreak");
  if (!wholeBlock) return { title, content: { ...doc, content: rest } };

  const heading = {
    ...body,
    type: "heading",
    attrs: { ...body.attrs, level: 1 },
  };
  return {
    title,
    content: { ...doc, content: [heading, ...rest.slice(start + 1)] },
  };
};
