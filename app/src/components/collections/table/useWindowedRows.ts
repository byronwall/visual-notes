import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
  type Accessor,
} from "solid-js";

/** Every body row is exactly this tall (TableRow sets the same literal). */
export const ROW_HEIGHT = 33;
/** Rows rendered before any measurement, identical on server and client. */
const INITIAL_WINDOW = 60;
const OVERSCAN = 15;
/** Below this, every row renders and nothing is windowed. */
export const WINDOW_THRESHOLD = 150;
/** Space kept between a revealed row and the window edge in a note embed. */
const EMBED_MARGIN = 48;

/** The part of the viewport where rows can show, in client coordinates. */
const viewBand = (scroller: HTMLElement | undefined) => {
  if (!scroller) return { top: 0, bottom: window.innerHeight };
  const rect = scroller.getBoundingClientRect();
  return {
    top: Math.max(0, rect.top),
    bottom: Math.min(window.innerHeight, rect.top + scroller.clientHeight),
  };
};

/**
 * Fixed-height row windowing. A page table scrolls inside `scroller`; a note
 * embed passes no scroller and scrolls with the window. Returns the visible
 * slice bounds; callers render spacers around it.
 */
export function useWindowedRows(opts: {
  count: Accessor<number>;
  body: () => HTMLElement | undefined;
  scroller: () => HTMLElement | undefined;
  /** Heights of the sticky header and footer that cover the scroller. */
  insets: () => { top: number; bottom: number };
  /** Fixed height of every row; the table's ROW_HEIGHT by default. */
  rowHeight?: () => number;
}) {
  const rowH = () => opts.rowHeight?.() ?? ROW_HEIGHT;
  const [range, setRange] = createSignal({ start: 0, end: INITIAL_WINDOW });

  const measure = () => {
    const el = opts.body();
    const n = opts.count();
    // Small lists render whole (see bounds); keep the last real window.
    if (!el || n <= WINDOW_THRESHOLD) return;
    const band = viewBand(opts.scroller());
    const bodyTop = el.getBoundingClientRect().top;
    const first = Math.floor(Math.max(0, band.top - bodyTop) / rowH());
    const shown = Math.ceil(Math.max(0, band.bottom - band.top) / rowH());
    const start = Math.max(0, Math.min(n, first) - OVERSCAN);
    const end = Math.min(n, first + shown + OVERSCAN);
    const prev = range();
    if (prev.start !== start || prev.end !== end) setRange({ start, end });
  };

  onMount(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const scroller = opts.scroller();
    // An embed can sit in any scrolling ancestor, so capture every scroll.
    const target: EventTarget = scroller ?? window;
    const capture = !scroller;
    target.addEventListener("scroll", schedule, { capture, passive: true });
    window.addEventListener("resize", schedule);
    measure();
    // A search or filter changes the row count without scrolling.
    createEffect(on(opts.count, schedule, { defer: true }));
    onCleanup(() => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", schedule, { capture });
      window.removeEventListener("resize", schedule);
    });
  });

  const bounds = () => {
    const n = opts.count();
    if (n <= WINDOW_THRESHOLD) return { start: 0, end: n };
    const r = range();
    return {
      start: Math.min(r.start, n),
      end: Math.min(Math.max(r.end, r.start), n),
    };
  };

  /**
   * Scrolls so a row sits between the sticky header and footer, then renders
   * the rows around it (used by keyboard navigation).
   */
  const reveal = (index: number) => {
    const el = opts.body();
    if (!el) return;
    const scroller = opts.scroller();
    const rowTop = el.getBoundingClientRect().top + index * rowH();
    const rowBottom = rowTop + rowH();
    if (scroller) {
      const band = viewBand(scroller);
      const { top, bottom } = opts.insets();
      const minTop = band.top + top;
      const maxBottom = band.bottom - bottom;
      let target = scroller.scrollTop;
      if (rowTop < minTop) target -= minTop - rowTop;
      else if (rowBottom > maxBottom) target += rowBottom - maxBottom;
      scroller.scrollTop = target;
      measure();
      // Swapping the rendered rows can clamp the scroll position while the
      // spacers update; set it again once the window has settled.
      if (Math.abs(scroller.scrollTop - target) >= 1)
        scroller.scrollTop = target;
      return;
    } else if (rowTop < EMBED_MARGIN) {
      window.scrollBy({ top: rowTop - EMBED_MARGIN });
    } else if (rowBottom > window.innerHeight - EMBED_MARGIN) {
      window.scrollBy({ top: rowBottom - window.innerHeight + EMBED_MARGIN });
    }
    measure();
  };

  return { bounds, reveal, measure };
}
