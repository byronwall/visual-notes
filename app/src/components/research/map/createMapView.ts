import { createSignal, onCleanup } from "solid-js";
import type { MapBounds } from "./map-layout";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.5;
const PAD = 32;
// Same wheel feel as the canvas: mouse notches are large, pinches arrive as
// ctrl+wheel with small deltas.
const WHEEL_ZOOM = 0.0015;
const PINCH_ZOOM = 0.01;
const GLIDE_MS = 200;

const clampZoom = (value: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

/**
 * Pan and zoom for the map. The world's origin sits at the viewport's center
 * in plain CSS, so pan 0, zoom 1 needs no measuring and the server render is
 * already centered.
 */
export const createMapView = () => {
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [zoom, setZoom] = createSignal(1);
  const [gliding, setGliding] = createSignal(false);
  const [dragging, setDragging] = createSignal(false);
  let viewport: HTMLElement | undefined;
  let glideTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(glideTimer));

  const size = () => ({
    w: viewport?.clientWidth ?? 0,
    h: viewport?.clientHeight ?? 0,
  });

  /** Runs a view change with the short glide on. Drags and wheels skip it. */
  const glide = (change: () => void) => {
    clearTimeout(glideTimer);
    setGliding(true);
    change();
    glideTimer = setTimeout(() => setGliding(false), GLIDE_MS);
  };

  const zoomAt = (factor: number, focal?: { x: number; y: number }) => {
    const next = clampZoom(zoom() * factor);
    const { x: fx, y: fy } = focal ?? { x: 0, y: 0 };
    const ratio = next / zoom();
    setPan((prev) => ({
      x: fx - (fx - prev.x) * ratio,
      y: fy - (fy - prev.y) * ratio,
    }));
    setZoom(next);
  };

  /** Shows a whole bounds, shrinking but never enlarging past 100%. */
  const fit = (bounds: MapBounds) => {
    const { w, h } = size();
    if (!w || !h) return;
    const next = clampZoom(
      Math.min(1, (w - PAD * 2) / bounds.w, (h - PAD * 2) / bounds.h),
    );
    glide(() => {
      setZoom(next);
      setPan({
        x: -(bounds.x + bounds.w / 2) * next,
        y: -(bounds.y + bounds.h / 2) * next,
      });
    });
  };

  /** Moves the view just enough to show a bounds; the near edges win a tie. */
  const reveal = (bounds: MapBounds) => {
    const { w, h } = size();
    if (!w || !h) return;
    const shift = (start: number, end: number, half: number) => {
      const lead = Math.min(0, half - PAD - end);
      return start + lead < -half + PAD ? -half + PAD - start : lead;
    };
    const z = zoom();
    const left = bounds.x * z + pan().x;
    const top = bounds.y * z + pan().y;
    const dx = shift(left, left + bounds.w * z, w / 2);
    const dy = shift(top, top + bounds.h * z, h / 2);
    if (!dx && !dy) return;
    glide(() => setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy })));
  };

  /** Puts a bounds' middle at the viewport's center, at the current zoom. */
  const center = (bounds: MapBounds) => {
    const next = {
      x: -(bounds.x + bounds.w / 2) * zoom(),
      y: -(bounds.y + bounds.h / 2) * zoom(),
    };
    glide(() => setPan(next));
  };

  const nudge = (dx: number, dy: number) =>
    setPan((prev) => ({ x: prev.x + dx * zoom(), y: prev.y + dy * zoom() }));

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = viewport!.getBoundingClientRect();
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      const by = event.deltaX || event.deltaY;
      setPan((prev) => ({ ...prev, x: prev.x - by }));
      return;
    }
    const strength = event.ctrlKey ? PINCH_ZOOM : WHEEL_ZOOM;
    zoomAt(Math.pow(2, -event.deltaY * strength), {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2,
    });
  };

  /** Drag on empty space pans. A press on a node stays a click. */
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || target.closest("[data-node-id]")) return;
    const host = event.currentTarget as HTMLElement;
    host.setPointerCapture(event.pointerId);
    setDragging(true);
    let last = { x: event.clientX, y: event.clientY };
    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - last.x;
      const dy = move.clientY - last.y;
      last = { x: move.clientX, y: move.clientY };
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    };
    const onUp = () => {
      setDragging(false);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
  };

  const attach = (element: HTMLElement) => {
    viewport = element;
    // A passive listener could not stop the page from scrolling.
    element.addEventListener("wheel", onWheel, { passive: false });
    onCleanup(() => element.removeEventListener("wheel", onWheel));
  };

  return {
    attach,
    pan,
    zoom,
    gliding,
    dragging,
    fit,
    reveal,
    center,
    nudge,
    glide,
    // oxlint-disable-next-line solid/reactivity
    zoomBy: (factor: number) => glide(() => zoomAt(factor)),
    onPointerDown,
  };
};

export type MapView = ReturnType<typeof createMapView>;
