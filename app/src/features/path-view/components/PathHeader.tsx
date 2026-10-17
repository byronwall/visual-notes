import { A } from "@solidjs/router";
import { For, Show, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { formatAbsoluteTime, formatRelativeTime } from "~/features/docs-index/utils/time";
import { buildPathAncestors, pathToRoute } from "~/utils/path-links";
import type { PathTreeNode } from "../utils/path-tree";

const headerClass = css({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "4",
  flexWrap: "wrap",
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
});

const sepClass = css({ color: "fg.subtle", opacity: 0.6, px: "0.5" });

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
  node?: PathTreeNode;
  actions?: JSX.Element;
}) => {
  const ancestors = () => buildPathAncestors(props.path).slice(0, -1);
  const leaf = () => props.path.split(".").pop() || props.path;

  return (
    <header class={headerClass}>
      <div class={css({ minW: "0" })}>
        <A
          href="/path"
          class={css({
            display: { base: "inline-block", md: "none" },
            mb: "1",
            fontSize: "sm",
            color: "fg.muted",
            textDecoration: "none",
          })}
        >
          ← All paths
        </A>
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
    </header>
  );
};
