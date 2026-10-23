import { For } from "solid-js";
import { css } from "styled-system/css";
import { scaleForLevel } from "../layout/fold";

const barClass = css({
  position: "absolute",
  top: "2",
  left: "2",
  display: "flex",
  alignItems: "center",
  gap: "1",
  p: "1",
  bg: "bg.default",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  fontSize: "xs",
  zIndex: 3,
});

const segmentClass = css({
  px: "2",
  h: "6",
  borderRadius: "l1",
  color: "fg.muted",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "gray.a3", color: "fg.default" },
  "&[data-active=true]": { bg: "bg.selected", color: "fg.selected", fontWeight: "medium" },
  "@media (pointer: coarse)": { h: "8" },
});

/** Level buttons zoom into that level's band; the active one follows the zoom. */
export const CanvasToolbar = (props: {
  band: number;
  level: number;
  draftCount: number;
  maxLevel: number;
  scale: number;
  onLevel: (scale: number) => void;
  onFit: () => void;
}) => {
  const levels = () => {
    const out = [{ label: "Detail", level: 0 }];
    if (props.maxLevel >= 1) out.push({ label: "Summaries", level: 1 });
    if (props.maxLevel >= 2) out.push({ label: "Overview", level: props.maxLevel });
    return out;
  };
  const activeLabel = () =>
    [...levels()].reverse().find((entry) => props.band >= entry.level)?.label ?? "Detail";
  const blocked = () => props.band > props.level;

  return (
    <div class={barClass} onPointerDown={(event) => event.stopPropagation()} role="toolbar" aria-label="Canvas view">
      <For each={levels()}>
        {(entry) => (
          <button
            type="button"
            class={segmentClass}
            data-active={activeLabel() === entry.label}
            onClick={() => props.onLevel(scaleForLevel(entry.level))}
          >
            {entry.label}
          </button>
        )}
      </For>
      <span class={css({ w: "1px", h: "4", bg: "border", mx: "1" })} />
      <button type="button" class={segmentClass} onClick={() => props.onFit()}>
        Fit
      </button>
      <span
        class={css({ w: "10", textAlign: "right", color: "fg.subtle", fontVariantNumeric: "tabular-nums", pr: "1" })}
      >
        {Math.round(props.scale * 100)}%
      </span>
      {/* Floats under the bar so showing it never moves anything. */}
      <span
        class={css({
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          px: "2",
          py: "0.5",
          fontSize: "xs",
          color: "amber.11",
          bg: "bg.default",
          borderRadius: "l1",
          whiteSpace: "nowrap",
        })}
        style={{ visibility: blocked() ? "visible" : "hidden" }}
        aria-hidden={!blocked()}
      >
        Accept {props.draftCount === 1 ? "the draft summary" : "draft summaries"} to fold
      </span>
    </div>
  );
};
