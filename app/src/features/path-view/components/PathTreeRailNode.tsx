import { A } from "@solidjs/router";
import { ChevronRightIcon } from "lucide-solid";
import { For, Show } from "solid-js";
import { css, cx } from "styled-system/css";
import { renderHighlighted } from "~/features/docs-index/utils/highlight";
import { pathToRoute } from "~/utils/path-links";
import type { PathTreeNode } from "../utils/path-tree";
import { PathHoverCard } from "./PathHoverCard";

const rowClass = css({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "16px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "1",
  minH: "7",
  pr: "2",
  borderRadius: "l2",
  color: "fg.muted",
  transitionProperty: "background-color, color",
  transitionDuration: "fast",
  _hover: { bg: "bg.muted", color: "fg.default" },
  "&[data-active]": {
    bg: "gray.a3",
    color: "fg.default",
    fontWeight: "semibold",
  },
});

const toggleClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "4",
  h: "4",
  borderRadius: "l1",
  color: "fg.subtle",
  position: "relative",
  zIndex: 1,
  cursor: "pointer",
  transitionProperty: "transform, color, background-color",
  transitionDuration: "fast",
  _hover: { color: "fg.default", bg: "gray.a4" },
  "&[data-expanded]": { transform: "rotate(90deg)" },
  _motionReduce: { transition: "none" },
});

const labelClass = css({
  minW: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontFamily: "mono",
  fontSize: "13px",
  lineHeight: "1.4",
  color: "inherit",
  textDecoration: "none",
  py: "1",
  outline: "none",
  // Stretch the link so the whole row (count included) navigates.
  _after: {
    content: '""',
    position: "absolute",
    inset: "0",
    borderRadius: "l2",
  },
});

const itemClass = css({
  outline: "none",
  "&:focus-visible > [data-row]": {
    boxShadow: "inset 0 0 0 2px token(colors.gray.8)",
  },
});

const countClass = css({
  fontSize: "xs",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
});

export type PathTreeRailNodeProps = {
  node: PathTreeNode;
  activePath: string;
  /** The one row in the tab order (roving tabindex). */
  tabbablePath: string;
  query: string;
  isExpanded: (path: string) => boolean;
  onToggle: (path: string) => void;
  onNavigate?: () => void;
};

export const PathTreeRailNode = (props: PathTreeRailNodeProps) => {
  const hasChildren = () => props.node.children.length > 0;
  const expanded = () => hasChildren() && props.isExpanded(props.node.path);
  const active = () => props.activePath === props.node.path;

  return (
    <li
      role="treeitem"
      class={itemClass}
      data-tree-path={props.node.path}
      tabIndex={props.tabbablePath === props.node.path ? 0 : -1}
      aria-level={props.node.depth}
      aria-expanded={hasChildren() ? expanded() : undefined}
      aria-selected={active()}
      aria-current={active() ? "page" : undefined}
      aria-label={`${props.node.segment}, ${props.node.totalCount} ${props.node.totalCount === 1 ? "note" : "notes"}`}
    >
      <div
        data-row
        class={rowClass}
        data-active={active() ? "" : undefined}
        style={{ "padding-left": `${(props.node.depth - 1) * 14 + 4}px` }}
      >
        <Show when={hasChildren()} fallback={<span />}>
          {/* Mouse affordance only; keyboard users expand with Left/Right on the row. */}
          <span
            aria-hidden="true"
            class={toggleClass}
            data-expanded={expanded() ? "" : undefined}
            data-tree-toggle
            onClick={() => props.onToggle(props.node.path)}
          >
            <ChevronRightIcon size={12} />
          </span>
        </Show>
        <PathHoverCard path={props.node.path} placement="right-start">
          {(triggerProps) => (
            <A
              {...triggerProps}
              href={pathToRoute(props.node.path)}
              class={labelClass}
              tabIndex={-1}
              onClick={() => props.onNavigate?.()}
            >
              {props.query
                ? renderHighlighted(props.node.segment, props.query)
                : props.node.segment}
            </A>
          )}
        </PathHoverCard>
        <span class={countClass} aria-hidden="true">
          {props.node.totalCount}
        </span>
      </div>
      <Show when={expanded()}>
        <ul role="group" class={cx(css({ listStyle: "none" }))}>
          <For each={props.node.children}>
            {(child) => <PathTreeRailNode {...props} node={child} />}
          </For>
        </ul>
      </Show>
    </li>
  );
};
