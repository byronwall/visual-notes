import { Dynamic } from "solid-js/web";
import { splitProps, type Component, type JSX } from "solid-js";
import { useSolidNodeView } from "./useSolidNodeView";

type NodeViewWrapperProps = {
  as?: string | Component<Record<string, unknown>>;
  style?: JSX.CSSProperties;
  ref?: (el: Element) => void;
  [key: string]: unknown;
};

export function NodeViewWrapper(props: NodeViewWrapperProps) {
  const { state } = useSolidNodeView();
  const [local, rest] = splitProps(props, ["as", "style", "ref"]);

  return (
    <Dynamic
      component={local.as || "div"}
      ref={local.ref}
      data-node-view-wrapper="true"
      onDragStart={state().onDragStart}
      style={{
        ...local.style,
        "white-space": "normal",
      }}
      {...rest}
    />
  );
}
