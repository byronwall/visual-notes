import { getSchema } from "@tiptap/core";
import sanitizeHtml from "sanitize-html";
import { generateHTML, generateJSON } from "@tiptap/html";
import type { Schema } from "@tiptap/pm/model";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";
import { assignBlockIds } from "./ids";
import { stripIdTags, toMarkdown } from "./markdown";
import { buildNoteExtensions } from "./schema";
import { emptyNoteDoc, isNoteDoc, type NoteDoc } from "./types";

export { toMarkdown, toPlainText } from "./markdown";

let cachedExtensions: ReturnType<typeof buildNoteExtensions> | undefined;
let cachedSchema: Schema | undefined;

export function noteExtensions() {
  cachedExtensions ??= buildNoteExtensions();
  return cachedExtensions;
}

export function noteSchema(): Schema {
  cachedSchema ??= getSchema(noteExtensions());
  return cachedSchema;
}

/**
 * Validates a document against the note schema and returns it normalized,
 * with every block id present and unique. Throws on structurally invalid
 * content (unknown node types, illegal nesting).
 */
export function normalizeNoteDoc(input: unknown): NoteDoc {
  if (!isNoteDoc(input)) throw new Error("Note content must be a doc node");
  const node = noteSchema().nodeFromJSON(input);
  node.check();
  const json = node.toJSON() as NoteDoc;
  if (!json.content?.length) return assignBlockIds(emptyNoteDoc());
  return assignBlockIds(json);
}

/** Parses stored or pasted HTML into blocks; unknown markup is simplified. */
export function fromHtml(html: string): NoteDoc {
  const trimmed = html.trim();
  if (!trimmed) return assignBlockIds(emptyNoteDoc());
  // Empty imported links have no text node to carry their href in ProseMirror.
  const htmlWithLinkLabels = trimmed.replace(/<a\b[^>]*>\s*<\/a>/gi, (anchor) =>
    sanitizeHtml(anchor, {
      allowedTags: ["a"],
      allowedAttributes: { a: ["href", "title", "target", "rel"] },
      transformTags: {
        a: (tagName, attribs) => ({
          tagName,
          attribs,
          text: attribs.href ?? "",
        }),
      },
    }),
  );
  const json = generateJSON(htmlWithLinkLabels, noteExtensions()) as NoteDoc;
  return normalizeNoteDoc(json);
}

export function fromMarkdown(markdown: string): NoteDoc {
  return fromHtml(normalizeMarkdownToHtml(stripIdTags(markdown)));
}

// The server build of generateHTML serializes through an XML document and
// stamps the XHTML namespace on top-level elements; it is noise in HTML.
const XHTML_NS = / xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g;

export function toHtml(doc: NoteDoc): string {
  return generateHTML(doc, noteExtensions()).replace(XHTML_NS, "");
}

/**
 * Best-effort read of a legacy row: content when present, else the editor's
 * HTML, else the original markdown.
 */
export function contentFromLegacy(doc: {
  content?: unknown;
  html?: string | null;
  markdown?: string | null;
}): NoteDoc {
  if (isNoteDoc(doc.content)) return doc.content;
  if (doc.html?.trim()) return fromHtml(doc.html);
  return fromMarkdown(doc.markdown ?? "");
}

/** The legacy string columns, derived from blocks during the transition. */
export function legacyColumns(doc: NoteDoc) {
  return { html: toHtml(doc), markdown: toMarkdown(doc) };
}
