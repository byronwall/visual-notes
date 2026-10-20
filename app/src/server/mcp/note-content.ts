import TurndownService from "turndown";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

/**
 * Markdown view of a note. The editor saves HTML, so HTML is the current
 * content whenever it exists; stored markdown is only trusted for notes that
 * have never been saved from the editor.
 */
export function noteToMarkdown(doc: {
  html: string;
  markdown: string;
}): string {
  const html = doc.html?.trim();
  if (html) return turndown.turndown(html).trim();
  return (doc.markdown ?? "").trim();
}

export type NoteContent = { markdown: string; html: string };

export function contentFromMarkdown(markdown: string): NoteContent {
  return { markdown, html: normalizeMarkdownToHtml(markdown) };
}

/** Appends markdown below the current content without re-rendering it. */
export function appendMarkdown(
  doc: { html: string; markdown: string },
  addition: string,
): NoteContent {
  const currentHtml = doc.html?.trim()
    ? doc.html
    : normalizeMarkdownToHtml(doc.markdown ?? "");
  const html = `${currentHtml}\n${normalizeMarkdownToHtml(addition)}`;
  return { html, markdown: `${noteToMarkdown(doc)}\n\n${addition.trim()}` };
}
