import { TableHeader } from "@tiptap/extension-table-header";
import { createMemo } from "solid-js";
import { createSolidNodeViewRenderer, NodeViewWrapper, useSolidNodeView } from "../nodeviews";

function CustomTableHeaderNodeView() {
  const { state } = useSolidNodeView();
  const htmlAttributes = createMemo(() => state().HTMLAttributes || {});

  return <NodeViewWrapper as="th" {...htmlAttributes()} />;
}

export const CustomTableHeader = TableHeader.extend({
  addNodeView() {
    return createSolidNodeViewRenderer(CustomTableHeaderNodeView, {
      useDomAsContentDOM: true,
    });
  },
});
