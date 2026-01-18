import { type JSX, Component, children, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

export function WrapWhen(props: {
  when: boolean;
  children: JSX.Element;
  component: Component<{ children: JSX.Element }>;
}) {
  const resolvedChildren = children(() => props.children);

  return (
    <Show when={props.when} fallback={resolvedChildren()}>
      <Dynamic component={props.component}>{resolvedChildren()}</Dynamic>
    </Show>
  );
}
