import { createSignal, onCleanup, onMount } from "solid-js";

/** The table never gets shorter than this, even under a tall phone header. */
const MIN_HEIGHT = 256;

/**
 * Space under `el` inside the page: padding and siblings of its ancestors,
 * up to the first ancestor with a min-height (whose slack is not content).
 */
const spaceBelow = (el: HTMLElement) => {
  let outer = el;
  while (
    outer.parentElement &&
    outer.parentElement !== document.body &&
    ["0px", "auto"].includes(getComputedStyle(outer.parentElement).minHeight)
  )
    outer = outer.parentElement;
  return Math.max(
    0,
    outer.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom,
  );
};

/**
 * Measures the table's scroller: its width (for narrow layouts and the
 * right-edge fade) and, on a page, the height that fills the viewport from
 * the scroller's top so the page itself does not need to scroll.
 */
export function useScrollerFit(opts: {
  scroller: () => HTMLElement | undefined;
  grid: () => HTMLElement | undefined;
  fitHeight: boolean;
}) {
  const [width, setWidth] = createSignal(0);
  const [maxHeight, setMaxHeight] = createSignal<number | null>(null);
  const [moreRight, setMoreRight] = createSignal(false);

  const measureEdge = () => {
    const el = opts.scroller();
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    setWidth(clientWidth);
    setMoreRight(scrollWidth - clientWidth - scrollLeft > 1);
  };

  const measureHeight = () => {
    const el = opts.scroller();
    if (!el || !opts.fitHeight) return;
    const docTop = el.getBoundingClientRect().top + window.scrollY;
    const fit = window.innerHeight - docTop - spaceBelow(el);
    const next = Math.max(MIN_HEIGHT, Math.floor(fit));
    if (next !== maxHeight()) setMaxHeight(next);
  };

  onMount(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        measureHeight();
        measureEdge();
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(opts.scroller()!);
    observer.observe(opts.grid()!);
    // Content above the table (toolbar rows, a header that wraps) moves its
    // top; the body resizes whenever that happens.
    if (opts.fitHeight) observer.observe(document.body);
    window.addEventListener("resize", measure);
    measureHeight();
    measureEdge();
    onCleanup(() => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    });
  });

  return { width, maxHeight, moreRight, measureEdge };
}
