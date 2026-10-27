import { createSignal, onCleanup } from "solid-js";
import { css } from "styled-system/css";
import { FLYOUT_WIDTH, RAIL_WIDTH, VIEWPORT_PADDING } from "./constants";
import { TocOutline } from "./TocOutline";
import { TocRail } from "./TocRail";
import { type TocController } from "./useTocController";

const panelClass = css({
  position: "fixed",
  top: "50%",
  display: "flex",
  p: "1.5",
  bg: "bg.default",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l3",
  boxShadow: "md",
  transitionProperty: "opacity, transform",
  transitionDuration: "160ms",
  transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
  _motionReduce: { transition: "none" },
});

/**
 * Rail mode: the note leaves no gutter for the outline, so a slim rail sits
 * at the edge and the outline opens beside it on hover or focus. Opening on
 * hover never moves focus, so typing in the note is not interrupted.
 */
export function TocFlyout(props: { toc: TocController }) {
  const [hovered, setHovered] = createSignal(false);
  let hoverTimer: number | undefined;
  // A short open delay ignores a pointer passing over the rail; a longer
  // close delay lets it cross the gap between the rail and the panel.
  const hoverSoon = (next: boolean) => {
    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => setHovered(next), next ? 80 : 220);
  };
  onCleanup(() => window.clearTimeout(hoverTimer));
  const [focused, setFocused] = createSignal(false);
  let panelEl: HTMLDivElement | undefined;
  const open = () => hovered() || focused();
  const panelLeft = () =>
    Math.max(VIEWPORT_PADDING, props.toc.layout().leftPx - FLYOUT_WIDTH - 6);

  return (
    <div
      style={{
        position: "fixed",
        left: `${props.toc.layout().leftPx}px`,
        top: `${props.toc.railTopPx()}px`,
        width: `${RAIL_WIDTH}px`,
        height: `${props.toc.layout().railHeightPx}px`,
        "z-index": "30",
        "user-select": "none",
      }}
      onMouseEnter={() => hoverSoon(true)}
      onMouseLeave={() => hoverSoon(false)}
      onFocusIn={() => setFocused(true)}
      onFocusOut={(event) => {
        const next = event.relatedTarget as Node | null;
        if (!next || !event.currentTarget.contains(next)) setFocused(false);
      }}
    >
      <TocRail
        toc={props.toc}
        onActivate={() => panelEl?.querySelector("input")?.focus()}
      />
      <div
        ref={panelEl}
        class={panelClass}
        inert={!open()}
        style={{
          left: `${panelLeft()}px`,
          width: `${FLYOUT_WIDTH}px`,
          "max-height": "calc(100vh - 48px)",
          opacity: open() ? "1" : "0",
          transform: `translateY(-50%) translateX(${open() ? 0 : 8}px)`,
          "pointer-events": open() ? "auto" : "none",
        }}
      >
        <TocOutline
          toc={props.toc}
          class={css({ flex: "1" })}
          onSelect={(item) => {
            props.toc.onItemClick(item);
            // Drop focus so the panel closes once the pointer leaves.
            (document.activeElement as HTMLElement | null)?.blur();
            setFocused(false);
          }}
        />
      </div>
    </div>
  );
}
