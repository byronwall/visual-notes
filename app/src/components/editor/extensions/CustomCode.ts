import Code from "@tiptap/extension-code";

export const CustomCode = Code.extend({
  addAttributes() {
    // TODO:AS_ANY, extend base attrs; parent() is not well-typed in Tiptap's API
    const parent = (this as any).parent?.() ?? {};
    return {
      ...parent,
      spellcheck: {
        default: false,
        renderHTML: (attrs: { spellcheck?: boolean }) => ({
          spellcheck: attrs.spellcheck ? "true" : "false",
        }),
      },
    } as any;
  },
});
