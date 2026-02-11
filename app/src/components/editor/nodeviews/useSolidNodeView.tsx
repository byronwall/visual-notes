import { createContext, useContext, type Accessor } from "solid-js";
import type { NodeViewRendererProps } from "@tiptap/core";

export type Attrs = Record<string, unknown>;

export type SolidNodeViewState<A extends Attrs = Attrs> = Omit<
  NodeViewRendererProps,
  "node" | "editor"
> & {
  node: NodeViewRendererProps["node"] & { attrs: A };
  editor: NodeViewRendererProps["editor"];
  selected: boolean;
  updateAttributes: (attributes: Record<string, unknown>) => boolean;
  deleteNode: () => void;
  onDragStart?: (event: DragEvent) => void;
};

type SolidNodeViewContextValue<A extends Attrs = Attrs> = {
  state: Accessor<SolidNodeViewState<A>>;
};

const SolidNodeViewContext = createContext<SolidNodeViewContextValue>();

export function useSolidNodeView<A extends Attrs = Attrs>() {
  const ctx = useContext(SolidNodeViewContext) as
    | SolidNodeViewContextValue<A>
    | undefined;
  if (!ctx) {
    throw new Error("useSolidNodeView must be used inside a NodeView renderer");
  }
  return ctx;
}

export { SolidNodeViewContext };
