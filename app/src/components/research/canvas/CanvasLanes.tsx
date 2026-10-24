import { For } from "solid-js";
import { css } from "styled-system/css";
import { TYPE_PLURAL } from "../layout/sections";
import type { LaneLabel } from "../layout/tree-layout";

const labelClass = css({
  position: "absolute",
  left: 0,
  top: 0,
  transformOrigin: "0 0",
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  fontSize: "12px",
  fontWeight: "medium",
  letterSpacing: "wide",
  textTransform: "uppercase",
  color: "fg.muted",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  transitionProperty: "left, top, opacity",
  "&[data-dimmed=true]": { opacity: 0.3 },
  transitionDuration: "200ms",
  "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
});

/** Section headings over a busy branch's children: "Options 9". They dim with their cards during a search. */
export const CanvasLanes = (props: { lanes: LaneLabel[]; factor: number; matched: Set<string> | null }) => (
  <For each={props.lanes}>
    {(lane) => (
      <div
        class={labelClass}
        data-testid="research-canvas-lane"
        data-dimmed={!!props.matched && !lane.memberIds.some((id) => props.matched!.has(id))}
        style={{
          left: `${lane.rect.x}px`,
          top: `${lane.rect.y}px`,
          height: `${lane.rect.h / props.factor}px`,
          transform: props.factor === 1 ? undefined : `scale(${props.factor})`,
        }}
      >
        {TYPE_PLURAL[lane.type]}
        <span class={css({ color: "fg.subtle", fontVariantNumeric: "tabular-nums" })}>{lane.count}</span>
      </div>
    )}
  </For>
);
