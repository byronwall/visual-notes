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
const resizer = css({
  position: "absolute",
  top: "0",
  right: "-3px",
  bottom: "0",
  w: "6px",
  cursor: "col-resize",
  zIndex: "4",
  _hover: { bg: "border.accent" },
  "&[data-active]": { bg: "border.accent" },
});

const MIN_WIDTH = 80;
const MAX_WIDTH = 720;

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
    const widthAt = (x: number) =>
      Math.round(
        Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + x - startX)),
      );
    const move = (ev: PointerEvent) =>
      props.onResize(widthAt(ev.clientX), false);
    const up = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      delete handle.dataset.active;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      props.onResize(widthAt(ev.clientX), true);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
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
        aria-label={`Resize ${props.property.name}`}
        onPointerDown={startResize}
        onDblClick={() =>
          props.onResize(
            props.property.id === TITLE_PROPERTY_ID ? 280 : 180,
            true,
          )
        }
      />
    </div>
  );
};
