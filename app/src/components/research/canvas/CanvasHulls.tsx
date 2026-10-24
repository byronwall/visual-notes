import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import type { FoldHull } from "../layout/fold";
import { HULL_LABEL_H, type Rect } from "../layout/tree-layout";

const hullClass = css({
  position: "absolute",
  borderWidth: "1px",
  borderColor: "gray.a6",
  borderRadius: "l3",
  bg: "gray.a2",
  pointerEvents: "none",
  transitionProperty: "left, top, width, height, border-color, box-shadow",
  transitionDuration: "200ms",
  "&[data-status=draft]": { borderStyle: "dashed", borderColor: "amber.a7", bg: "amber.a2" },
  "&[data-selected=true]": {
    borderStyle: "solid",
    borderColor: "border.selected",
    boxShadow: "0 0 0 1px token(colors.border.selected)",
  },
  "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
});

const labelClass = css({
  position: "absolute",
  left: 0,
  top: 0,
  transformOrigin: "0 0",
  display: "flex",
  alignItems: "center",
  gap: "2",
  px: "2",
  fontSize: "12px",
  whiteSpace: "nowrap",
  pointerEvents: "auto",
  maxWidth: "var(--label-max)",
  borderRadius: "l1",
  // A long summary title is cut to the hull's width; hovering shows all of it.
  _hover: { maxWidth: "none", zIndex: 4, bg: "bg.default", boxShadow: "0 0 0 1px token(colors.border)" },
});

const labelButtonClass = css({
  color: "fg.link",
  cursor: "pointer",
  px: "1",
  borderRadius: "l1",
  transitionProperty: "background-color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover" },
});

/** Unfolded summary groups: a tinted region with the summary title and draft review actions. */
export const CanvasHulls = (props: {
  hulls: { hull: FoldHull; rect: Rect }[];
  factor: number;
  selectedId: string | null;
  onSelect: (cardId: string) => void;
  onAccept: (groupId: string) => void;
}) => (
  <For each={props.hulls}>
    {(entry) => (
      <div
        class={hullClass}
        data-status={entry.hull.status}
        data-selected={props.selectedId === entry.hull.summaryCard.id}
        data-testid="research-canvas-hull"
        style={{
          left: `${entry.rect.x}px`,
          top: `${entry.rect.y}px`,
          width: `${entry.rect.w}px`,
          height: `${entry.rect.h}px`,
        }}
      >
        <div
          class={labelClass}
          style={{
            height: `${HULL_LABEL_H}px`,
            "--label-max": `${entry.rect.w / props.factor}px`,
            transform: props.factor === 1 ? undefined : `scale(${props.factor})`,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            class={css({
              fontWeight: "medium",
              color: "gray.12",
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              _hover: { color: "fg.link" },
            })}
            onClick={() => props.onSelect(entry.hull.summaryCard.id)}
          >
            {entry.hull.summaryCard.title}
          </button>
          <Show when={entry.hull.status === "draft"}>
            <span class={css({ color: "amber.11" })}>Draft summary</span>
            <button type="button" class={labelButtonClass} onClick={() => props.onAccept(entry.hull.groupId)}>
              Accept
            </button>
          </Show>
        </div>
      </div>
    )}
  </For>
);
