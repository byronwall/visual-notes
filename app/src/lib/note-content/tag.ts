import { Node, mergeAttributes } from "@tiptap/core";

/** Lowercase letters, digits, dash, underscore, slash; 1–64 chars. */
export const TAG_PATTERN = /^[a-z0-9][a-z0-9_\-/]{0,63}$/;

export const normalizeTagName = (raw: string) =>
  raw.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "-");

/** Inline `#tag` on a block; indexed so blocks can be listed by tag. */
export const Tag = Node.create({
  name: "tag",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-tag") ?? "",
        renderHTML: (attrs: { name: string }) => ({ "data-tag": attrs.name }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-tag]" }, { tag: "span[data-tag]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = String(node.attrs.name);
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href: `/tags/${encodeURIComponent(name)}`,
        class: "note-tag",
      }),
      `#${name}`,
    ];
  },

  renderText({ node }) {
    return `#${node.attrs.name}`;
  },
});
