import {
  batch,
  createEffect,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";
import type { Accessor } from "solid-js";
import type { Point } from "./labels/label-geometry";
import { SettledViewGate, type CanvasView } from "./labels/settled-view";

/**
 * The view that labels are planned for. It follows the live zoom and pan
 * only after they have been still for a moment, so label membership and
 * placement never change mid-gesture or mid-animation.
 *
 * `epoch` bumps whenever labels should re-plan: each time the view settles.
 * `requestReplan` (for data or selection changes) restarts the same idle
 * timer, so a click that both selects a region and starts a camera move
 * re-plans once, at rest.
 */
export function useSettledView(args: {
  zoom: Accessor<number>;
  offset: Accessor<Point>;
}) {
  const gate = new SettledViewGate(
    untrack(() => ({ zoom: args.zoom(), offset: args.offset() })),
  );
  const [view, setView] = createSignal<CanvasView>(gate.settled);
  const [epoch, setEpoch] = createSignal(0);
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
        if (committed) {
          batch(() => {
            setView(committed);
            setEpoch((value) => value + 1);
          });
        } else if (gate.hasPending) {
          schedule();
        }
      },
      gate.msUntilCommit(performance.now()) + 1,
    );
  };

  createEffect(() => {
    const live = { zoom: args.zoom(), offset: args.offset() };
    if (gate.observe(live, performance.now())) schedule();
  });

  const requestReplan = () => {
    gate.touch(performance.now());
    schedule();
  };

  onCleanup(clear);

  return { view, epoch, requestReplan };
}
