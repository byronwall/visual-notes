import { createEffect, createSignal, onCleanup, untrack } from "solid-js";
import type { Accessor } from "solid-js";

const LULL_MS = 120;
const MAX_BURST_MS = 280;
const MIN_ZOOM_CHANGE = 0.02;

/**
 * The zoom that region labels draw at. It trails the live zoom during a
 * gesture and commits after a 120 ms lull, or at most 280 ms into a burst,
 * so label text does not rescale on every wheel tick. Changes under 2% are
 * ignored.
 */
export function useRegionLabelDisplayZoom(zoomScale: Accessor<number>) {
  const [displayZoom, setDisplayZoom] = createSignal(untrack(zoomScale));
  let lullTimer: number | undefined;
  let maxTimer: number | undefined;
  let burstStartedAt = 0;

  const clearTimers = () => {
    if (lullTimer !== undefined) {
      clearTimeout(lullTimer);
      lullTimer = undefined;
    }
    if (maxTimer !== undefined) {
      clearTimeout(maxTimer);
      maxTimer = undefined;
    }
  };

  const commit = (nextZoom: number) => {
    clearTimers();
    burstStartedAt = 0;
    setDisplayZoom((current) =>
      Math.abs(current - nextZoom) < 0.001 ? current : nextZoom,
    );
  };

  createEffect(() => {
    const nextZoom = zoomScale();
    const currentDisplayZoom = displayZoom();
    if (Math.abs(nextZoom - currentDisplayZoom) < MIN_ZOOM_CHANGE) {
      clearTimers();
      burstStartedAt = 0;
      return;
    }

    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!burstStartedAt) {
      burstStartedAt = now;
    }

    if (lullTimer !== undefined) {
      clearTimeout(lullTimer);
    }
    lullTimer = window.setTimeout(() => {
      commit(zoomScale());
    }, LULL_MS);

    if (maxTimer === undefined) {
      const remaining = Math.max(0, MAX_BURST_MS - (now - burstStartedAt));
      maxTimer = window.setTimeout(() => {
        commit(zoomScale());
      }, remaining);
    }
  });

  onCleanup(clearTimers);

  return displayZoom;
}
