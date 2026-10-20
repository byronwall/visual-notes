import { createSignal, onCleanup, onMount, type Accessor } from "solid-js";

export const ROW_HEIGHT = 36;
/** Rows rendered before any measurement, identical on server and client. */
const INITIAL_WINDOW = 60;
const OVERSCAN = 15;
/** Below this, every row renders and nothing is windowed. */
export const WINDOW_THRESHOLD = 150;

/**
 * Fixed-height row windowing against whatever scrolls the grid (the page or a
 * note). Returns the visible slice bounds; callers render spacers around it.
 */
export function useWindowedRows(
  count: Accessor<number>,
  body: () => HTMLElement | undefined,
) {
  const [range, setRange] = createSignal({ start: 0, end: INITIAL_WINDOW });

  const measure = () => {
    const el = body();
    if (!el) return;
    if (count() <= WINDOW_THRESHOLD) {
      setRange({ start: 0, end: count() });
      return;
    }
    const top = el.getBoundingClientRect().top;
    const viewport = window.innerHeight;
    const first = Math.floor(Math.max(0, -top) / ROW_HEIGHT);
    const visible = Math.ceil(viewport / ROW_HEIGHT);
    const start = Math.max(0, first - OVERSCAN);
    const end = Math.min(count(), first + visible + OVERSCAN);
    const prev = range();
    if (prev.start !== start || prev.end !== end) setRange({ start, end });
  };

  onMount(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    // Capture scroll events from any scrolling ancestor, not just the window.
    window.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", schedule);
    measure();
    onCleanup(() => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    });
  });

  const bounds = () => {
    const n = count();
    if (n <= WINDOW_THRESHOLD) return { start: 0, end: n };
    const r = range();
    return {
      start: Math.min(r.start, n),
      end: Math.min(Math.max(r.end, r.start), n),
    };
  };

  /** Scrolls so a row index is on screen (used by keyboard navigation). */
  const reveal = (index: number) => {
    const el = body();
    if (!el) return;
    const rowTop = el.getBoundingClientRect().top + index * ROW_HEIGHT;
    if (rowTop < 80) window.scrollBy({ top: rowTop - 120 });
    else if (rowTop + ROW_HEIGHT > window.innerHeight)
      window.scrollBy({ top: rowTop + ROW_HEIGHT - window.innerHeight + 40 });
    measure();
  };

  return { bounds, reveal, measure };
}
