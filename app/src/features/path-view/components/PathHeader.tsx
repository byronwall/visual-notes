import { A } from "@solidjs/router";
import { For, Show, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { formatAbsoluteTime, formatRelativeTime } from "~/features/docs-index/utils/time";
import { buildPathAncestors, pathToRoute } from "~/utils/path-links";
import type { PathTreeNode } from "../utils/path-tree";
import { PathTreePopover } from "./PathTreePopover";

// A div, not <header>: panda.css styles bare <header> as the sticky app bar.
const headerClass = css({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "4",
});

const titleClass = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  fontFamily: "mono",
  fontSize: { base: "xl", md: "2xl" },
  fontWeight: "semibold",
  letterSpacing: "-0.01em",
  lineHeight: "1.25",
  wordBreak: "break-word",
});

const crumbLinkClass = css({
  color: "fg.subtle",
  textDecoration: "none",
  borderRadius: "l1",
  transitionProperty: "color",
  transitionDuration: "fast",
  _hover: { color: "fg.default" },
  _focusVisible: { outline: "2px solid", outlineColor: "border.focus", outlineOffset: "2px" },
});

const sepClass = css({ color: "fg.subtle" });

const titleRowClass = css({ display: "flex", alignItems: "flex-start", gap: "1" });

// Pull the button left so its icon, not its hit area, lines up with the content edge.
const treeButtonClass = css({
  display: { base: "block", xl: "none" },
  flexShrink: 0,
  ml: "-2",
  mt: { base: "-1", md: "-0.5" },
});

const statsClass = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "1.5",
  mt: "1",
  fontSize: "sm",
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
});

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export const PathHeader = (props: {
  path: string;
  tree: PathTreeNode;
  node?: PathTreeNode;
  actions?: JSX.Element;
}) => {
  const ancestors = () => buildPathAncestors(props.path).slice(0, -1);
  const leaf = () => props.path.split(".").pop() || props.path;

  return (
    <div class={headerClass}>
      <div class={css({ minW: "0", flex: "1" })}>
        <div class={titleRowClass}>
          <div class={treeButtonClass}>
            <PathTreePopover tree={props.tree} activePath={props.path} />
          </div>
          <h1 class={titleClass}>
            <For each={ancestors()}>
              {(ancestor) => (
                <>
                  <A href={pathToRoute(ancestor)} class={crumbLinkClass}>
                    {ancestor.split(".").pop()}
                  </A>
                  <span class={sepClass}>.</span>
                </>
              )}
            </For>
            <span>{leaf()}</span>
          </h1>
        </div>
        <Show when={props.node}>
          {(node) => (
            <p class={statsClass}>
              <span>{plural(node().totalCount, "note")}</span>
              <Show when={node().children.length > 0}>
                <span aria-hidden="true">·</span>
                <span>{plural(node().children.length, "subpath")}</span>
              </Show>
              <Show when={node().lastUpdatedAt}>
                {(updatedAt) => (
                  <>
                    <span aria-hidden="true">·</span>
                    <span title={formatAbsoluteTime(updatedAt())}>
                      updated {formatRelativeTime(updatedAt())}
                    </span>
                  </>
                )}
              </Show>
            </p>
          )}
        </Show>
      </div>
      {/* Read `actions` once: a JSX prop getter re-creates its elements on every read. */}
      <div class={css({ display: "flex", gap: "2", flexShrink: 0 })}>{props.actions}</div>
    </div>
  );
};
