import { createEffect, onCleanup, onMount, type Accessor } from "solid-js";
import { MOBILE_APP_BAR_PX, useMobileAppBar } from "./mobile-app-bar";

/**
 * Shows `title` in the phone app bar once the page's own heading has
 * scrolled under the bar, the way iOS large titles collapse into the
 * navigation bar. Before that, the bar keeps its section name so the title
 * never appears twice on screen.
 */
export function useMobileBarTitleOnScroll(options: {
  title: Accessor<string | undefined>;
  getHeadingEl: () => HTMLElement | null | undefined;
}) {
  const appBar = useMobileAppBar();
  let frame: number | undefined;

  const update = () => {
    frame = undefined;
    const rect = options.getHeadingEl()?.getBoundingClientRect();
    // A heading that isn't laid out yet measures 0×0 at the top; ignore it.
    const scrolledPast =
      !!rect && rect.height > 0 && rect.bottom <= MOBILE_APP_BAR_PX;
    appBar.setTitle(scrolledPast ? options.title() : undefined);
  };

  const schedule = () => {
    if (frame === undefined) frame = window.requestAnimationFrame(update);
  };

  onMount(() => {
    window.addEventListener("scroll", schedule, { passive: true });
    schedule();
    onCleanup(() => {
      window.removeEventListener("scroll", schedule);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      appBar.setTitle(undefined);
    });
  });

  // A rename while scrolled down should reach the bar without a scroll.
  createEffect(() => {
    options.title();
    schedule();
  });
}
