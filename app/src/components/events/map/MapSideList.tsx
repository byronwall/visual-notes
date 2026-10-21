import { A } from "@solidjs/router";
import { For, Show, createEffect, on } from "solid-js";
import { css } from "styled-system/css";
import type { MapPoint } from "./mapPoints";

const list = css({
  display: "flex",
  flexDirection: "column",
  gap: "0.5",
  overflowY: "auto",
  minH: "0",
  h: "full",
});
const item = css({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  columnGap: "2",
  alignItems: "baseline",
  w: "full",
  textAlign: "left",
  px: "2",
  py: "1.5",
  borderRadius: "l2",
  cursor: "pointer",
  _hover: { bg: "bg.subtle" },
  "&[aria-current=true]": { bg: "bg.muted" },
});
const dot = css({
  w: "2.5",
  h: "2.5",
  borderRadius: "full",
  bg: "var(--ink)",
  transform: "translateY(1px)",
});
const name = css({
  fontSize: "sm",
  fontWeight: "medium",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const meta = css({
  gridColumn: "2",
  fontSize: "xs",
  color: "fg.muted",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const links = css({
  gridColumn: "2",
  display: "flex",
  flexDirection: "column",
  mt: "0.5",
  "& a": {
    fontSize: "xs",
    color: "fg.default",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    _hover: { textDecoration: "underline" },
  },
});

const when = css({
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
  mr: "1.5",
});

/** Rows synced with the markers: click pans the map, a marker scrolls here. */
export function MapSideList(props: {
  points: MapPoint[];
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  let el!: HTMLDivElement;
  createEffect(
    on(
      () => props.selectedId,
      (id) =>
        el
          .querySelector(`[data-point="${CSS.escape(id ?? "")}"]`)
          ?.scrollIntoView({ block: "nearest" }),
      { defer: true },
    ),
  );
  return (
    <div class={list} ref={el} aria-label="Places on the map">
      <For each={props.points}>
        {(p) => (
          <div
            class={item}
            role="button"
            tabIndex={0}
            data-point={p.id}
            aria-current={props.selectedId === p.id}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest("a")) props.onPick(p.id);
            }}
            onKeyDown={(e) => e.key === "Enter" && props.onPick(p.id)}
          >
            <span class={dot} style={{ "--ink": p.ink }} />
            <span class={name} title={p.name}>
              {p.name}
            </span>
            <span class={meta} title={p.address || undefined}>
              {p.meta || p.address}
            </span>
            <div class={links}>
              <For each={p.links.slice(0, 3)}>
                {(l) => (
                  <A
                    href={l.href}
                    title={[l.text, l.meta].filter(Boolean).join(" · ")}
                  >
                    <Show when={l.when}>
                      <span class={when}>{l.when}</span>
                    </Show>
                    {l.text}
                  </A>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
