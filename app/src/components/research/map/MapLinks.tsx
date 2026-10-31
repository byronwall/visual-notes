import { For } from "solid-js";
import { css } from "styled-system/css";
import type { MapState } from "./createMapState";

const linkClass = css({
  fill: "none",
  stroke: "gray.a6",
  strokeWidth: 1.5,
  transitionProperty: "opacity, stroke",
  transitionDuration: "140ms",
  "&[data-active=true]": { stroke: "border.focus", strokeWidth: 2 },
  "&[data-dimmed=true]": { opacity: 0.3 },
  "[data-gliding=true] &": {
    transitionProperty: "d, opacity, stroke",
    transitionDuration: "180ms",
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
});

/** Curved connectors, one per visible node but the root. */
export const MapLinks = (props: { state: MapState }) => (
  <svg
    aria-hidden="true"
    class={css({
      position: "absolute",
      left: 0,
      top: 0,
      overflow: "visible",
      pointerEvents: "none",
    })}
    width="1"
    height="1"
  >
    {/* Keyed by id string, so a path keeps its element and can glide. */}
    <For
      each={props.state
        .layout()
        .boxes.slice(1)
        .map((box) => box.id)}
    >
      {(id) => (
        <path
          class={linkClass}
          d={props.state.layout().links.get(id) ?? ""}
          data-active={props.state.selectedPath().has(id)}
          data-dimmed={props.state.isDimmed(id)}
        />
      )}
    </For>
  </svg>
);
