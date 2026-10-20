import { Node, mergeAttributes } from "@tiptap/core";

/**
 * A live collection view embedded in a note. The node stores only which
 * hosted `CollectionView` to show; filters, sorts, and layout live with the
 * view. The editor layers an interactive Solid NodeView on top
 * (components/editor/extensions/CollectionViewNode.tsx).
 */
export const CollectionView = Node.create({
  name: "collectionView",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      viewId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-collection-view") || null,
        renderHTML: (attrs: { viewId?: string | null }) => ({
          "data-collection-view": attrs.viewId ?? "",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-collection-view]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes)];
  },
});
