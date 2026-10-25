import { css } from "styled-system/css";

const handleClass = css({
  position: "absolute",
  top: 0,
  bottom: 0,
  left: "-3px",
  w: "6px",
  cursor: "col-resize",
  zIndex: 1,
  touchAction: "none",
  display: { base: "none", lg: "block" },
  _before: {
    content: '""',
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "2.5px",
    w: "1px",
    bg: "transparent",
    transitionProperty: "background-color",
    transitionDuration: "140ms",
  },
  _hover: { _before: { bg: "border.focus" } },
  _focusVisible: { outline: "none", _before: { bg: "border.focus", w: "2px" } },
});

/** Drag to resize the reader rail; double-click resets; arrow keys step it. */
export const ReaderResizeHandle = (props: {
  width: () => number;
  onDragStart: (event: PointerEvent) => void;
  onStep: (delta: number) => void;
  onReset: () => void;
}) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize reader"
    aria-valuenow={props.width()}
    tabIndex={0}
    title="Drag to resize · double-click to reset"
    class={handleClass}
    data-testid="research-reader-resize"
    onPointerDown={(event) => props.onDragStart(event)}
    onDblClick={() => props.onReset()}
    onKeyDown={(event) => {
      if (event.key === "ArrowLeft") props.onStep(32);
      else if (event.key === "ArrowRight") props.onStep(-32);
      else return;
      event.preventDefault();
    }}
  />
);
