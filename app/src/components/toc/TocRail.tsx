import { For } from "solid-js";
import { css } from "styled-system/css";
import { type TocController } from "./useTocController";

const railClass = css({
  position: "relative",
  w: "full",
  h: "full",
  borderRadius: "l2",
  cursor: "pointer",
  outline: "none",
  transitionProperty: "background-color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover" },
  _focusVisible: { outline: "2px solid", outlineColor: "border.focus" },
});

const windowClass = css({
  position: "absolute",
  left: "1",
  right: "1",
  borderRadius: "l1",
  bg: "gray.a3",
  transitionProperty: "top, height",
  transitionDuration: "180ms",
  _motionReduce: { transition: "none" },
});

const markerClass = css({
  position: "absolute",
  left: "50%",
  borderRadius: "full",
  bg: "gray.a7",
  transitionProperty: "background-color",
  transitionDuration: "140ms",
  "&[data-active=true]": { bg: "fg.default" },
});

const MARKER_WIDTH = [14, 10, 7, 5];

/**
 * Narrow-screen stand-in for the outline: one tick per heading at its place
 * in the note, with a soft band for the part on screen. Hover or focus opens
 * the full outline.
 */
export function TocRail(props: { toc: TocController; onActivate: () => void }) {
  const depth = (level: number) =>
    Math.min(Math.max(level - props.toc.minHeadingLevel(), 0), 3);
  const bounds = () => props.toc.visibleMarkerBounds();

  return (
    <div
      class={railClass}
      tabIndex={0}
      role="button"
      aria-label="Contents"
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        props.onActivate();
      }}
    >
      <div
        class={css({ position: "absolute", inset: "3" })}
        style={{ left: 0, right: 0 }}
      >
        <div
          class={windowClass}
          style={{
            top: `calc(${(bounds().topRatio * 100).toFixed(1)}% - 6px)`,
            height: `calc(${Math.max((bounds().bottomRatio - bounds().topRatio) * 100, 0).toFixed(1)}% + 12px)`,
          }}
        />
        <For each={props.toc.markers()}>
          {(marker) => (
            <div
              class={markerClass}
              data-active={marker.index === props.toc.activeIndex()}
              style={{
                top: `${(marker.displayTopRatio * 100).toFixed(1)}%`,
                width: `${MARKER_WIDTH[depth(marker.item.level)]}px`,
                height: depth(marker.item.level) <= 1 ? "2px" : "1.5px",
                transform: "translate(-50%, -50%)",
              }}
            />
          )}
        </For>
      </div>
    </div>
  );
}
