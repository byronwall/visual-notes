import { TableRow } from "@tiptap/extension-table-row";
import { createMemo } from "solid-js";
import { createSolidNodeViewRenderer, NodeViewWrapper, useSolidNodeView } from "../nodeviews";

function CustomTableRowNodeView() {
  const { state } = useSolidNodeView();
  const htmlAttributes = createMemo(() => state().HTMLAttributes || {});

  return <NodeViewWrapper as="tr" {...htmlAttributes()} />;
}

export const CustomTableRow = TableRow.extend({
  addNodeView() {
    return createSolidNodeViewRenderer(CustomTableRowNodeView, {
      useDomAsContentDOM: true,
    });
  },
});
