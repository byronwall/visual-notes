import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";

export const CustomCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    console.log("[CustomCodeBlock] addAttributes");
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
}).configure({ lowlight: createLowlight(common) });
