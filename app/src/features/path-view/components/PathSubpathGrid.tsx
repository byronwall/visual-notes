import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import {
  ONE_DAY_MS,
  formatAbsoluteTime,
  formatRelativeTime,
} from "~/features/docs-index/utils/time";
import { pathToRoute } from "~/utils/path-links";
import type { PathTreeNode } from "../utils/path-tree";
import { PathHoverCard } from "./PathHoverCard";

const MAX_NESTED = 4;

const gridClass = css({
  display: "grid",
  gridTemplateColumns: {
    base: "repeat(auto-fill, minmax(150px, 1fr))",
    md: "repeat(auto-fill, minmax(220px, 1fr))",
  },
  gap: "2",
});

const tileClass = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "0.5",
  minW: "0",
  px: "3",
  py: "2.5",
  borderRadius: "l2",
  bg: "bg.subtle",
  transitionProperty: "background-color",
  transitionDuration: "fast",
  _hover: { bg: "bg.muted" },
  _focusWithin: { bg: "bg.muted" },
});

const tileLinkClass = css({
  fontFamily: "mono",
  fontSize: "sm",
  fontWeight: "semibold",
  color: "fg.default",
  textDecoration: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  outline: "none",
  // Stretch the link so the whole tile opens the subpath.
  _after: { content: '""', position: "absolute", inset: "0", borderRadius: "l2" },
  _focusVisible: { _after: { boxShadow: "0 0 0 2px token(colors.gray.8)" } },
});

const metaClass = css({
  fontSize: "xs",
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
  "& [data-fresh]": { color: "green.11" },
});

const nestedClass = css({
  display: "flex",
  flexWrap: "wrap",
  columnGap: "2",
  rowGap: "0.5",
  mt: "1",
  fontFamily: "mono",
  fontSize: "xs",
  color: "fg.subtle",
});

const nestedLinkClass = css({
  position: "relative",
  zIndex: 1,
  py: "0.5",
  color: "fg.muted",
  textDecoration: "none",
  _hover: { color: "fg.default", textDecoration: "underline" },
});

const isFresh = (iso: string | null) => !!iso && Date.now() - new Date(iso).getTime() < ONE_DAY_MS;

const nodeMeta = (node: PathTreeNode) =>
  [
    `${node.totalCount} ${node.totalCount === 1 ? "note" : "notes"}`,
    node.lastUpdatedAt ? `updated ${formatRelativeTime(node.lastUpdatedAt)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

export const PathSubpathGrid = (props: { nodes: PathTreeNode[] }) => (
  <ul class={gridClass} aria-label="Subpaths">
    <For each={props.nodes}>
      {(node) => (
        <li class={tileClass}>
          <PathHoverCard path={node.path} meta={nodeMeta(node)}>
            {(triggerProps) => (
              <A {...triggerProps} href={pathToRoute(node.path)} class={tileLinkClass}>
                {node.segment}
              </A>
            )}
          </PathHoverCard>
          <span class={metaClass}>
            {node.totalCount} {node.totalCount === 1 ? "note" : "notes"}
            <Show when={node.lastUpdatedAt}>
              {(updatedAt) => (
                <>
                  {" · "}
                  <span
                    data-fresh={isFresh(updatedAt()) ? "" : undefined}
                    title={`Last updated ${formatAbsoluteTime(updatedAt())}`}
                  >
                    {formatRelativeTime(updatedAt())}
                  </span>
                </>
              )}
            </Show>
          </span>
          <Show when={node.children.length > 0}>
            <span class={nestedClass}>
              <For each={node.children.slice(0, MAX_NESTED)}>
                {(child) => (
                  <A href={pathToRoute(child.path)} class={nestedLinkClass}>
                    {child.segment}
                  </A>
                )}
              </For>
              <Show when={node.children.length > MAX_NESTED}>
                <span>+{node.children.length - MAX_NESTED}</span>
              </Show>
            </span>
          </Show>
        </li>
      )}
    </For>
  </ul>
);
