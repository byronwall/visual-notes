import { createSignal } from "solid-js";

const START_PX = 10;
const ACTION_PX = 88;
// iOS Safari owns swipes that start at the screen edge (back and forward).
const EDGE_PX = 24;

type Options = {
  onRight: () => void;
  onLeft: () => void;
};

/** Horizontal touch swipe on a row. Vertical drags stay with the list scroll. */
export const createRowSwipe = (options: Options) => {
  const [dx, setDx] = createSignal(0);
  let start: { x: number; y: number } | null = null;
  let swiping = false;
  let swallowClick = false;

  const reset = () => {
    start = null;
    swiping = false;
    setDx(0);
  };

  return {
    dx,
    armed: () => Math.abs(dx()) >= ACTION_PX,
    /** True once for the click that ends a swipe. */
    consumeClick: () => {
      const swallowed = swallowClick;
      swallowClick = false;
      return swallowed;
    },
    onPointerDown: (event: PointerEvent) => {
      const nearEdge =
        event.clientX < EDGE_PX || event.clientX > window.innerWidth - EDGE_PX;
      if (event.pointerType !== "touch" || nearEdge) return;
      start = { x: event.clientX, y: event.clientY };
    },
    onPointerMove: (event: PointerEvent & { currentTarget: HTMLElement }) => {
      if (!start) return;
      const x = event.clientX - start.x;
      const y = event.clientY - start.y;
      if (!swiping) {
        if (Math.abs(y) > START_PX) return reset();
        if (Math.abs(x) < START_PX) return;
        swiping = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      setDx(x);
    },
    onPointerUp: () => {
      const distance = dx();
      const swiped = swiping;
      reset();
      if (!swiped) return;
      swallowClick = true;
      if (distance >= ACTION_PX) options.onRight();
      else if (distance <= -ACTION_PX) options.onLeft();
    },
    onPointerCancel: reset,
  };
};
