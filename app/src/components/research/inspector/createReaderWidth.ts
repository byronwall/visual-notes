import { createSignal, onMount } from "solid-js";

// Width of the topic reader rail, in px. null means the CSS default
// (22rem / 26rem), so SSR and first paint agree; a saved width applies
// after mount because only the browser knows it.

const KEY = "research-reader-width";
export const READER_MIN = 280;
const viewportMax = () => Math.max(READER_MIN, Math.min(1200, Math.round(window.innerWidth * 0.7)));

export const clampReaderWidth = (width: number, max: number) =>
  Math.round(Math.min(Math.max(width, READER_MIN), Math.max(READER_MIN, max)));

export const createReaderWidth = () => {
  const [width, setWidth] = createSignal<number | null>(null);

  onMount(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (saved) setWidth(clampReaderWidth(saved, viewportMax()));
    } catch {
      // Storage can be blocked; keep the default width.
    }
  });

  const save = (next: number | null) => {
    try {
      if (next === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(next));
    } catch {
      // Not saved; the width still applies for this visit.
    }
  };

  /** Starts a drag from the rail's left edge; moving left widens the rail. */
  const startDrag = (event: PointerEvent, currentWidth: number) => {
    event.preventDefault();
    const startX = event.clientX;
    const max = viewportMax();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const onMove = (move: PointerEvent) => setWidth(clampReaderWidth(currentWidth + startX - move.clientX, max));
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      save(width());
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  const nudge = (delta: number, currentWidth: number) => {
    const next = clampReaderWidth(currentWidth + delta, viewportMax());
    setWidth(next);
    save(next);
  };

  const reset = () => {
    setWidth(null);
    save(null);
  };

  return { width, startDrag, nudge, reset };
};
