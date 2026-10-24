import { Node, mergeAttributes } from "@tiptap/core";

/**
 * A file kept with a note (PDF, spreadsheet, archive, ...), shown as a card.
 * The bytes live at `src` (/api/doc-files/<hash>/<name>); the node keeps the
 * display name, type, and size so the card renders without a request. Stored
 * HTML is a plain download link, so read-only views and exports work as-is.
 * The editor layers a Solid NodeView on top
 * (components/editor/extensions/FileAttachmentNode.tsx).
 */

export type FileAttachmentAttrs = {
  src: string | null;
  name: string;
  mime: string | null;
  size: number | null;
};

const parseSize = (value: string | null) => {
  const n = Number(value);
  return value && Number.isFinite(n) && n >= 0 ? n : null;
};

export const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("data-src") ||
          el.querySelector("a")?.getAttribute("href") ||
          null,
        renderHTML: (attrs: FileAttachmentAttrs) => ({
          "data-src": attrs.src ?? "",
        }),
      },
      name: {
        default: "file",
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("data-name") || el.textContent?.trim() || "file",
        renderHTML: (attrs: FileAttachmentAttrs) => ({
          "data-name": attrs.name,
        }),
      },
      mime: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-mime") || null,
        renderHTML: (attrs: FileAttachmentAttrs) =>
          attrs.mime ? { "data-mime": attrs.mime } : {},
      },
      size: {
        default: null,
        parseHTML: (el: HTMLElement) => parseSize(el.getAttribute("data-size")),
        renderHTML: (attrs: FileAttachmentAttrs) =>
          attrs.size == null ? {} : { "data-size": String(attrs.size) },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-file-attachment]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as FileAttachmentAttrs;
    return [
      "div",
      mergeAttributes({ "data-file-attachment": "" }, HTMLAttributes),
      [
        "a",
        { href: attrs.src ?? "", download: attrs.name, rel: "noopener" },
        attrs.name,
      ],
    ];
  },
});
