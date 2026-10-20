/**
 * Mirrors the visual viewport into `--vv-top` and `--vv-height` on <html>.
 *
 * iOS keeps the layout viewport (and `100dvh`) full height when the
 * on-screen keyboard opens; only the visual viewport shrinks and pans.
 * Phone sheets and the keyboard toolbar size and place themselves from
 * these variables so they stay inside the area the user can actually see.
 * Returns a cleanup function.
 */
export function trackVisualViewport(): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  const root = document.documentElement;
  let frame: number | undefined;

  const write = () => {
    frame = undefined;
    root.style.setProperty("--vv-top", `${Math.round(viewport.offsetTop)}px`);
    root.style.setProperty("--vv-height", `${Math.round(viewport.height)}px`);
  };
  const schedule = () => {
    if (frame === undefined) frame = window.requestAnimationFrame(write);
  };

  write();
  viewport.addEventListener("resize", schedule);
  viewport.addEventListener("scroll", schedule);
  return () => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    viewport.removeEventListener("resize", schedule);
    viewport.removeEventListener("scroll", schedule);
  };
}
