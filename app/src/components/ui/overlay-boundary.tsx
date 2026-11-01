import { Suspense, type Component, type JSX } from "solid-js";

/**
 * Gives overlay content its own Suspense boundary. An overlay mounts on a
 * click, outside any transition, so a resource's first read in it falls back
 * at the nearest boundary. Without this one, that is the page behind it.
 */
export const withOverlayBoundary = <P extends { children?: JSX.Element }>(
  Content: Component<P>,
): Component<P> => {
  return (props) => (
    <Content {...props}>
      <Suspense>{props.children}</Suspense>
    </Content>
  );
};
