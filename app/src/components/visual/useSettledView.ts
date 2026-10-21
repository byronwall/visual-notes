import { createEffect, createSignal, onCleanup, untrack } from "solid-js";
import type { Accessor } from "solid-js";
import type { Point } from "./labels/label-geometry";
import { SettledViewGate, type CanvasView } from "./labels/settled-view";

/**
 * The view that labels are planned for. It follows the live zoom and pan
 * only after they have been still for a moment, so label membership and
 * placement never change mid-gesture or mid-animation.
 */
export function useSettledView(args: {
  zoom: Accessor<number>;
  offset: Accessor<Point>;
}): Accessor<CanvasView> {
  const gate = new SettledViewGate(
    untrack(() => ({ zoom: args.zoom(), offset: args.offset() })),
  );
  const [settled, setSettled] = createSignal<CanvasView>(gate.settled);
  let timer: number | undefined;

  const clear = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
  };
  const schedule = () => {
    clear();
    timer = window.setTimeout(
      () => {
        timer = undefined;
        const now = performance.now();
        const committed = gate.tick(now);
        if (committed) setSettled(committed);
        else if (gate.hasPending) schedule();
      },
      gate.msUntilCommit(performance.now()) + 1,
    );
  };

  createEffect(() => {
    const view = { zoom: args.zoom(), offset: args.offset() };
    if (gate.observe(view, performance.now())) schedule();
  });
  onCleanup(clear);

  return settled;
}
