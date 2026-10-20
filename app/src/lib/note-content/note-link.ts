import { Node, mergeAttributes } from "@tiptap/core";

export type NoteLinkAttrs = {
  docId: string | null;
  blockId: string | null;
  /** Last known target title (or heading text); refreshed on every read. */
  label: string;
  /** Set on read when the target note or block no longer exists. */
  missing?: boolean;
};

export const noteLinkHref = (attrs: Pick<NoteLinkAttrs, "docId" | "blockId">) =>
  `/docs/${attrs.docId ?? ""}${attrs.blockId ? `#b-${attrs.blockId}` : ""}`;

/**
 * Inline link to another note, or to one block inside it. Stores ids, not
 * text, so renames and edits never break it; the label is display only.
 */
export const NoteLink = Node.create({
  name: "noteLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      docId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-doc-id"),
        renderHTML: (attrs: NoteLinkAttrs) => ({ "data-doc-id": attrs.docId }),
      },
      blockId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-block-id"),
        renderHTML: (attrs: NoteLinkAttrs) =>
          attrs.blockId ? { "data-block-id": attrs.blockId } : {},
      },
      label: {
        default: "",
        parseHTML: (el: HTMLElement) => el.textContent ?? "",
        renderHTML: () => ({}),
      },
      missing: {
        default: false,
        parseHTML: (el: HTMLElement) => el.hasAttribute("data-missing"),
        renderHTML: (attrs: NoteLinkAttrs) =>
          attrs.missing ? { "data-missing": "true" } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-note-link]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as NoteLinkAttrs;
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-note-link": "",
        href: noteLinkHref(attrs),
        class: "note-link",
      }),
      attrs.label || "Untitled note",
    ];
  },

  renderText({ node }) {
    return (node.attrs as NoteLinkAttrs).label || "";
  },
});
