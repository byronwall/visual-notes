import { TableCell } from "@tiptap/extension-table-cell";
import { createMemo } from "solid-js";
import { createSolidNodeViewRenderer, NodeViewWrapper, useSolidNodeView } from "../nodeviews";

function CustomTableCellNodeView() {
  const { state } = useSolidNodeView();
  const htmlAttributes = createMemo(() => state().HTMLAttributes || {});

  return <NodeViewWrapper as="td" {...htmlAttributes()} />;
}

export const CustomTableCell = TableCell.extend({
  addNodeView() {
    return createSolidNodeViewRenderer(CustomTableCellNodeView, {
      useDomAsContentDOM: true,
    });
  },
});
