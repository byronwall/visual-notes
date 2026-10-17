import { A } from "@solidjs/router";
import { For } from "solid-js";
import { css } from "styled-system/css";
import { formatAbsoluteTime, formatRelativeTime } from "~/features/docs-index/utils/time";
import { pathToRoute } from "~/utils/path-links";

export type PathRecentItem = { path: string; count: number; at: string | null };

const rowClass = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto auto",
  alignItems: "baseline",
  gap: "3",
  px: "2",
  py: "1.5",
  mx: "-2",
  borderRadius: "l2",
  textDecoration: "none",
  color: "fg.default",
  transitionProperty: "background-color",
  transitionDuration: "fast",
  _hover: { bg: "bg.muted" },
  _focusVisible: { outline: "2px solid", outlineColor: "gray.8" },
});

const pathClass = css({
  fontFamily: "mono",
  fontSize: "sm",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  "& [data-parent]": { color: "fg.subtle" },
});

const metaClass = css({
  fontSize: "xs",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});

const splitParent = (path: string) => {
  const index = path.lastIndexOf(".");
  return index < 0 ? ["", path] : [path.slice(0, index + 1), path.slice(index + 1)];
};

export const PathRecentList = (props: {
  title: string;
  items: PathRecentItem[];
  verb: string;
}) => (
  <section class={css({ minW: "0" })}>
    <h2 class={css({ mb: "1", fontSize: "sm", fontWeight: "semibold", color: "fg.muted" })}>
      {props.title}
    </h2>
    <ul class={css({ listStyle: "none" })}>
      <For each={props.items}>
        {(item) => {
          const [parent, leaf] = splitParent(item.path);
          return (
            <li>
              <A href={pathToRoute(item.path)} class={rowClass} title={item.path}>
                <span class={pathClass}>
                  <span data-parent>{parent}</span>
                  {leaf}
                </span>
                <span class={metaClass}>{item.count}</span>
                <span
                  class={css({ fontSize: "xs", color: "fg.subtle", whiteSpace: "nowrap", minW: "14", textAlign: "right" })}
                  title={item.at ? `${props.verb} ${formatAbsoluteTime(item.at)}` : undefined}
                >
                  {item.at ? formatRelativeTime(item.at) : ""}
                </span>
              </A>
            </li>
          );
        }}
      </For>
    </ul>
  </section>
);
