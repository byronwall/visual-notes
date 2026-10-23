import { css, cx } from "styled-system/css";
import type { TimeBlockItem } from "~/services/time-blocks/time-blocks.service";
import { BlockFace, formatBlockRange } from "./BlockFace";
import {
  normalizeTimeBlockColor,
  readableTextColor,
} from "./time-block-colors";

export type BlockGeometry = {
  left: string;
  width: string;
  top: number;
  height: number;
};

/** Shared look for anything drawn as a block on the grid. */
export const blockShell = css({
  position: "absolute",
  px: "1",
  py: "0.5",
  borderRadius: "sm",
  overflow: "hidden",
  containerType: "inline-size",
  boxShadow: "0 0 0 1px var(--colors-bg-default)",
  userSelect: "none",
});

const interactiveBlock = css({
  cursor: "grab",
  transitionProperty: "filter, box-shadow, opacity",
  transitionDuration: "140ms",
  transitionTimingFunction: "ease",
  _hover: {
    filter: "brightness(1.08)",
    boxShadow:
      "0 0 0 1px var(--colors-bg-default), 0 4px 12px var(--colors-black-a4)",
  },
  _focusVisible: {
    outline: "2px solid var(--colors-border-focus)",
    outlineOffset: "1px",
  },
  "&[data-selected]": {
    outline: "2px solid var(--colors-fg-default)",
    outlineOffset: "1px",
    zIndex: 1,
  },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
});

const resizeHandle = css({
  position: "absolute",
  left: "0",
  right: "0",
  h: "6px",
  cursor: "ns-resize",
  zIndex: 1,
  "@media (hover: none)": { display: "none" },
});

type Props = {
  block: TimeBlockItem;
  geometry: BlockGeometry;
  dimmed: boolean;
  selected: boolean;
  onPointerDown: (event: PointerEvent, edge?: "top" | "bottom") => void;
  onActivate: (element: HTMLElement) => void;
  onKeyDown: (event: KeyboardEvent) => void;
};

export const TimeBlockCard = (props: Props) => {
  const start = () => new Date(props.block.startTime);
  const end = () => new Date(props.block.endTime);
  const title = () => props.block.title || "Untitled";
  const fill = () => normalizeTimeBlockColor(props.block.color);

  return (
    <div
      class={cx(blockShell, interactiveBlock)}
      data-time-block="true"
      data-testid="time-block-item"
      data-time-block-id={props.block.id}
      data-selected={props.selected ? "" : undefined}
      role="button"
      tabIndex={0}
      aria-label={`${title()}, ${formatBlockRange(start(), end())}`}
      style={{
        "background-color": fill(),
        color: readableTextColor(fill()),
        opacity: props.dimmed ? 0.35 : 1,
        left: props.geometry.left,
        width: props.geometry.width,
        top: `${props.geometry.top}px`,
        height: `${props.geometry.height}px`,
      }}
      onPointerDown={(event) => props.onPointerDown(event)}
      onClick={(event) => props.onActivate(event.currentTarget)}
      onKeyDown={(event) => props.onKeyDown(event)}
    >
      <div
        class={resizeHandle}
        style={{ top: "0" }}
        data-time-block="true"
        data-testid="time-block-resize-top"
        onPointerDown={(event) => props.onPointerDown(event, "top")}
      />
      <BlockFace
        title={title()}
        start={start()}
        end={end()}
        heightPx={props.geometry.height}
        isFixedTime={props.block.isFixedTime}
        hasNote={Boolean(props.block.noteId)}
      />
      <div
        class={resizeHandle}
        style={{ bottom: "0" }}
        data-time-block="true"
        data-testid="time-block-resize-bottom"
        onPointerDown={(event) => props.onPointerDown(event, "bottom")}
      />
    </div>
  );
};
