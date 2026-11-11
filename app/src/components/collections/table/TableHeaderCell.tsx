import { css } from "styled-system/css";
import type { CollectionProperty } from "~/lib/collections/types";
import { TITLE_PROPERTY_ID } from "~/lib/collections/types";
import { PropertyMenu } from "../menu/PropertyMenu";
import { PropertyKindIcon } from "../PropertyKindIcon";

const cell = css({
  position: "relative",
  display: "flex",
  minW: "0",
  "&[data-drop=before]::before, &[data-drop=after]::after": {
    content: '""',
    position: "absolute",
    top: "0",
    bottom: "0",
    w: "2px",
    bg: "border.accent",
    zIndex: "3",
  },
  "&[data-drop=before]::before": { left: "-1px" },
  "&[data-drop=after]::after": { right: "-1px" },
});
const button = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  h: "9",
  px: "2",
  color: "fg.muted",
  fontSize: "xs",
  fontWeight: "medium",
  cursor: "pointer",
  minW: "0",
  w: "full",
  textAlign: "left",
  borderRightWidth: "1px",
  borderColor: "border",
  _hover: { bg: "bg.muted" },
});
const label = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
// A 12px hit area just inside the column's right edge. Each header sits in
// its own sticky layer, so a handle that crossed the edge would lose its
// outer half under the next header. The visible line is the ::after bar at
// the edge, which shows on hover, drag and keyboard focus.
const resizer = css({
  position: "absolute",
  top: "0",
  right: "0",
  bottom: "0",
  w: "12px",
  cursor: "col-resize",
  zIndex: "4",
  touchAction: "none",
  outline: "none",
  "&::after": {
    content: '""',
    position: "absolute",
    top: "0",
    bottom: "0",
    right: "0",
    w: "4px",
    borderRadius: "full",
  },
  "&:hover::after, &[data-active]::after, &:focus-visible::after": {
    bg: "border.accent",
  },
  "&:focus-visible::after": {
    outline: "2px solid",
    outlineColor: "border.accent",
    outlineOffset: "1px",
  },
});

const MIN_WIDTH = 80;
const MAX_WIDTH = 720;
const STEP = 16;
const BIG_STEP = 64;
const clampWidth = (w: number) =>
  Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w)));

/** Column header: opens the property menu, resizes from its edge, drags to reorder. */
export const TableHeaderCell = (props: {
  property: CollectionProperty;
  viewId: string;
  width: number;
  dropSide: "before" | "after" | null;
  onResize: (width: number, done: boolean) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string, side: "before" | "after") => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) => {
  const movable = () => props.property.id !== TITLE_PROPERTY_ID;

  const startResize = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    handle.dataset.active = "";
    const startX = e.clientX;
    const startWidth = props.width;
    const widthAt = (x: number) => clampWidth(startWidth + x - startX);
    const move = (ev: PointerEvent) =>
      props.onResize(widthAt(ev.clientX), false);
    const up = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      delete handle.dataset.active;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      props.onResize(widthAt(ev.clientX), true);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  const defaultWidth = () =>
    props.property.id === TITLE_PROPERTY_ID ? 280 : 180;

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? BIG_STEP : STEP;
    const next =
      e.key === "ArrowLeft"
        ? props.width - step
        : e.key === "ArrowRight"
          ? props.width + step
          : e.key === "Home"
            ? MIN_WIDTH
            : e.key === "End"
              ? MAX_WIDTH
              : e.key === "Enter"
                ? defaultWidth()
                : null;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    props.onResize(clampWidth(next), true);
  };

  return (
    <div
      class={cell}
      role="columnheader"
      data-drop={props.dropSide ?? undefined}
      onDragOver={(e) => {
        if (!movable()) return;
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        props.onDragOver(
          props.property.id,
          e.clientX < rect.left + rect.width / 2 ? "before" : "after",
        );
      }}
      onDrop={(e) => {
        e.preventDefault();
        props.onDrop();
      }}
    >
      <PropertyMenu
        property={props.property}
        viewId={props.viewId}
        anchor={(open) => (
          <button
            type="button"
            class={button}
            draggable={movable()}
            onDragStart={(e) => {
              e.dataTransfer?.setData("text/plain", props.property.id);
              if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
              props.onDragStart(props.property.id);
            }}
            onDragEnd={() => props.onDragEnd()}
            onClick={open}
            aria-label={`${props.property.name} column menu`}
          >
            <PropertyKindIcon property={props.property} size={13} />
            <span class={label}>{props.property.name}</span>
          </button>
        )}
      />
      <div
        class={resizer}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${props.property.name} column`}
        aria-valuenow={Math.round(props.width)}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuetext={`${Math.round(props.width)} pixels`}
        title="Drag or use arrow keys to resize. Enter or double-click resets."
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={onKeyDown}
        onDblClick={() => props.onResize(defaultWidth(), true)}
      />
    </div>
  );
};
