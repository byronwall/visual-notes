import { marked } from "marked";
import { sanitizeHtmlContent } from "~/server/lib/markdown";
import { fromHtml } from "./convert";
import { stripIdTags } from "./markdown";
import type { NoteDoc, NoteNode } from "./types";
import { parseDocFileSrc } from "~/services/doc-files/doc-files.shared";

// The inverse of `toMarkdown`: reads the markdown an AI client gets from
// notes_get back into the same node types. Unlike `fromMarkdown` (used for
// imports and legacy rows), it turns these back into real nodes:
//   - [ ] text / - [x] text      top-level task line  -> taskRef
//   [[Label|docId]] / [[Label|docId#blockId]]          -> noteLink
//   #tag (starting with a letter)                      -> tag
//   {{collection-view:viewId}} on its own line         -> collectionView
//   [name](/api/doc-files/…) on its own line           -> fileAttachment
// Write `\#`, `\[` to keep a literal character.

const TASK_LINE = /^[-*+] \[( |x|X)\] (.*)$/;
const VIEW_LINE = /^\{\{collection-view:([A-Za-z0-9_-]{1,64})\}\}\s*$/;
const LINK_LINE = /^\[((?:\\.|[^\]\\])+)\]\((\S+?)\)\s*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const NOTE_LINK =
  /\[\[([^\]|\n]+)\|([A-Za-z0-9_-]{1,64})(?:#([A-Za-z0-9_-]{1,64}))?\]\]/g;
const TAG = /(^|[\s(])#([A-Za-z][A-Za-z0-9_\-/]{0,63})/g;
const LINK_OR_TAG = new RegExp(`${NOTE_LINK.source}|${TAG.source}`, "g");
const ENTITY_FOR: Record<string, string> = {
  "#": "&#35;",
  "[": "&#91;",
  "]": "&#93;",
  "{": "&#123;",
};

const escapeAttr = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");

/** `\#`, `\[`, `\]` outside inline code become entities so they stay literal. */
function protectEscapes(line: string): string {
  return line
    .split(/(`+[^`]*`+)/)
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(/\\([#[\]{])/g, (_m, ch: string) => ENTITY_FOR[ch]),
    )
    .join("");
}

/** A stored-file link alone on its line becomes an attachment block. */
function fileAttachmentHtml(line: string): string | null {
  const link = line.match(LINK_LINE);
  if (!link) return null;
  const stored = parseDocFileSrc(link[2]!);
  if (!stored) return null;
  const name = link[1]!.replace(/\\(.)/g, "$1").trim() || stored.name;
  const src = new URL(link[2]!, "http://x").pathname;
  return `<div data-file-attachment="" data-src="${escapeAttr(src)}" data-name="${escapeAttr(name)}"></div>`;
}

function preprocess(markdown: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of stripIdTags(markdown).split("\n")) {
    const opener = line.match(FENCE)?.[1];
    if (fence) {
      if (opener && opener[0] === fence[0] && opener.length >= fence.length)
        fence = null;
      out.push(line);
      continue;
    }
    if (opener) {
      fence = opener;
      out.push(line);
      continue;
    }
    const view = line.match(VIEW_LINE);
    if (view) {
      out.push(
        "",
        `<div data-collection-view="${escapeAttr(view[1])}"></div>`,
        "",
      );
      continue;
    }
    const file = fileAttachmentHtml(line);
    if (file) {
      out.push("", file, "");
      continue;
    }
    const task = line.match(TASK_LINE);
    if (task) {
      const status = task[1] === " " ? "waiting" : "complete";
      const inline = marked.parseInline(protectEscapes(task[2]), {
        breaks: true,
      }) as string;
      out.push(
        "",
        `<div data-task-ref="" data-status="${status}"><span data-task-text="">${inline}</span></div>`,
        "",
      );
      continue;
    }
    out.push(protectEscapes(line));
  }
  return out.join("\n");
}

/** Turns [[links]] and #tags in text into nodes, skipping code and links. */
function linkify(html: string): string {
  let skip = 0;
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith("<")) {
        if (/^<(code|pre|a)\b/i.test(part)) skip++;
        else if (/^<\/(code|pre|a)>/i.test(part)) skip = Math.max(0, skip - 1);
        return part;
      }
      if (skip) return part;
      // One pass, so a "#word" inside a link label stays part of the label.
      return part.replace(
        LINK_OR_TAG,
        (
          match,
          label?: string,
          docId?: string,
          blockId?: string,
          lead?: string,
          name?: string,
        ) => {
          if (docId) {
            const block = blockId
              ? ` data-block-id="${escapeAttr(blockId)}"`
              : "";
            return `<a data-note-link="" data-doc-id="${escapeAttr(docId)}"${block}>${label}</a>`;
          }
          if (!name) return match;
          const tag = name.toLowerCase();
          return `${lead}<span data-tag="${escapeAttr(tag)}">#${tag}</span>`;
        },
      );
    })
    .join("");
}

const NODE_ATTRIBUTES: Record<string, string[]> = {
  a: [
    "href",
    "name",
    "target",
    "rel",
    "data-note-link",
    "data-doc-id",
    "data-block-id",
  ],
  div: [
    "data-collection-view",
    "data-task-ref",
    "data-status",
    "data-file-attachment",
    "data-src",
    "data-name",
  ],
  span: ["class", "style", "data-task-text", "data-tag"],
};

export function noteMarkdownToHtml(markdown: string): string {
  const rendered = marked.parse(preprocess(markdown), {
    breaks: true,
  }) as string;
  return sanitizeHtmlContent(linkify(rendered), NODE_ATTRIBUTES).trim();
}

/** Parses markdown written in the notes_get dialect into note blocks. */
export function fromNoteMarkdown(markdown: string): NoteDoc {
  return fromHtml(noteMarkdownToHtml(markdown));
}

function walk(node: NoteNode, visit: (node: NoteNode) => void) {
  visit(node);
  node.content?.forEach((child) => walk(child, visit));
}

/** Note ids that noteLinks in these blocks point at. */
export function noteLinkTargets(nodes: NoteNode[]): string[] {
  const ids = new Set<string>();
  for (const node of nodes) {
    walk(node, (n) => {
      if (n.type === "noteLink" && n.attrs?.docId)
        ids.add(String(n.attrs.docId));
    });
  }
  return [...ids];
}

/** File attachment blocks in these blocks, in document order. */
export function fileAttachmentNodes(nodes: NoteNode[]): NoteNode[] {
  const found: NoteNode[] = [];
  for (const node of nodes) {
    walk(node, (n) => {
      if (n.type === "fileAttachment" && n.attrs?.src) found.push(n);
    });
  }
  return found;
}

/** Collection view ids embedded in these blocks. */
export function collectionViewIds(nodes: NoteNode[]): string[] {
  const ids = new Set<string>();
  for (const node of nodes) {
    walk(node, (n) => {
      if (n.type === "collectionView" && n.attrs?.viewId)
        ids.add(String(n.attrs.viewId));
    });
  }
  return [...ids];
}
