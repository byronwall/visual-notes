import { A } from "@solidjs/router";
import { For } from "solid-js";
import { css } from "styled-system/css";
import { formatAbsoluteTime, formatRelativeTime } from "~/features/docs-index/utils/time";
import { pathToRoute } from "~/utils/path-links";
import { PathHoverCard } from "./PathHoverCard";

/** `count` is the number of notes at the path; omit it when it would mean something else. */
export type PathRecentItem = { path: string; count?: number; at: string | null };

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
  _focusVisible: { outline: "2px solid", outlineColor: "border.focus" },
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

const recentMeta = (item: PathRecentItem, verb: string) =>
  [
    item.count === undefined ? "" : `${item.count} ${item.count === 1 ? "note" : "notes"}`,
    item.at ? `${verb.toLowerCase()} ${formatRelativeTime(item.at)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

export const PathRecentList = (props: { title: string; items: PathRecentItem[]; verb: string }) => (
  <section class={css({ minW: "0", p: "0" })}>
    <h2 class={css({ mb: "1", fontSize: "sm", fontWeight: "semibold", color: "fg.muted" })}>
      {props.title}
    </h2>
    <ul class={css({ listStyle: "none" })}>
      <For each={props.items}>
        {(item) => {
          const [parent, leaf] = splitParent(item.path);
          return (
            <li>
              <PathHoverCard
                path={item.path}
                clippedSelector="[data-path]"
                meta={recentMeta(item, props.verb)}
              >
                {(triggerProps) => (
                  <A {...triggerProps} href={pathToRoute(item.path)} class={rowClass}>
                    <span class={pathClass} data-path>
                      <span data-parent>{parent}</span>
                      {leaf}
                    </span>
                    <span class={metaClass}>
                      {item.count === undefined
                        ? ""
                        : `${item.count} ${item.count === 1 ? "note" : "notes"}`}
                    </span>
                    <span
                      class={css({
                        fontSize: "xs",
                        color: "fg.subtle",
                        whiteSpace: "nowrap",
                        minW: "14",
                        textAlign: "right",
                      })}
                      title={item.at ? `${props.verb} ${formatAbsoluteTime(item.at)}` : undefined}
                    >
                      {item.at ? formatRelativeTime(item.at) : ""}
                    </span>
                  </A>
                )}
              </PathHoverCard>
            </li>
          );
        }}
      </For>
    </ul>
  </section>
);
