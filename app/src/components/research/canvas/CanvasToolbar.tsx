import { LayersIcon } from "lucide-solid";
import { For, Show } from "solid-js";
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
  _hover: { bg: "bg.hover", color: "fg.default" },
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  "&[data-active=true]": { bg: "bg.selected", color: "fg.selected", fontWeight: "medium" },
  "&[data-tone=draft]": { color: "amber.11" },
  "@media (pointer: coarse)": { h: "8" },
});

/**
 * Level buttons zoom into that level's band; the active one follows the zoom.
 * They only appear once a summary is accepted, since nothing folds before that.
 */
export const CanvasToolbar = (props: {
  level: number;
  maxLevel: number;
  draftCount: number;
  scale: number;
  onLevel: (scale: number) => void;
  onFit: () => void;
  onReviewDrafts: () => void;
}) => {
  const levels = () => {
    if (props.maxLevel < 1) return [];
    const out = [
      { label: "Detail", level: 0 },
      { label: "Summaries", level: 1 },
    ];
    if (props.maxLevel >= 2) out.push({ label: "Overview", level: props.maxLevel });
    return out;
  };
  const activeLabel = () => [...levels()].reverse().find((entry) => props.level >= entry.level)?.label;

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
      <Show when={levels().length}>
        <span class={css({ w: "1px", h: "4", bg: "border", mx: "1" })} />
      </Show>
      <button type="button" class={segmentClass} onClick={() => props.onFit()}>
        Fit
      </button>
      <button
        type="button"
        class={segmentClass}
        title="Zoom to 100%"
        aria-label={`Zoom ${Math.round(props.scale * 100)}%, reset to 100%`}
        onClick={() => props.onLevel(1)}
      >
        <span class={css({ minW: "8", textAlign: "right", fontVariantNumeric: "tabular-nums" })}>
          {Math.round(props.scale * 100)}%
        </span>
      </button>
      <Show when={props.draftCount > 0}>
        <span class={css({ w: "1px", h: "4", bg: "border", mx: "1" })} />
        <button
          type="button"
          class={segmentClass}
          data-tone="draft"
          title="Agents drafted these summaries. Accept one to let its cards collapse into it when you zoom out."
          onClick={() => props.onReviewDrafts()}
        >
          <LayersIcon size={13} />
          {props.draftCount === 1 ? "1 summary to review" : `${props.draftCount} summaries to review`}
        </button>
      </Show>
    </div>
  );
};
