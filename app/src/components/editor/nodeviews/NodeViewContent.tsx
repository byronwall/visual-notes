import { Dynamic } from "solid-js/web";
import { splitProps, type Component, type JSX } from "solid-js";

type NodeViewContentProps = {
  as?: string | Component<Record<string, unknown>>;
  style?: JSX.CSSProperties;
  ref?: (el: Element) => void;
  [key: string]: unknown;
};

export function NodeViewContent(props: NodeViewContentProps) {
  const [local, rest] = splitProps(props, ["as", "style", "ref"]);

  return (
    <Dynamic
      component={local.as || "div"}
      ref={local.ref}
      data-node-view-content="true"
      style={{
        ...local.style,
        "white-space": "pre-wrap",
      }}
      {...rest}
    />
  );
}
