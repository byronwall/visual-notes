import type { JSX } from "solid-js";
import { css } from "styled-system/css";
import type { PathTreeNode } from "../utils/path-tree";
import { PathTreeRail } from "./PathTreeRail";

const shellClass = css({
  display: "grid",
  gridTemplateColumns: { base: "minmax(0, 1fr)", md: "248px minmax(0, 1fr)" },
  minH: "100vh",
  bg: "bg.default",
  color: "fg.default",
});

const railClass = css({
  display: { base: "none", md: "block" },
  position: "sticky",
  top: "0",
  alignSelf: "start",
  h: "100vh",
  overflowY: "auto",
  overscrollBehavior: "contain",
  px: "3",
  py: "4",
  bg: "bg.subtle",
});

const mainClass = css({
  minW: "0",
  px: { base: "4", md: "8" },
  pt: { base: "4", md: "5" },
  pb: "16",
});

export const PathBrowserShell = (props: {
  tree: PathTreeNode;
  activePath: string;
  children: JSX.Element;
}) => (
  <div class={shellClass}>
    <aside class={railClass}>
      <PathTreeRail tree={props.tree} activePath={props.activePath} />
    </aside>
    <main class={mainClass}>
      <div class={css({ maxW: "1080px" })}>{props.children}</div>
    </main>
  </div>
);
