import { batch, createMemo, createSignal } from "solid-js";

const isBrowser = typeof window !== "undefined";

export const CANVAS_MIN_SCALE = 0.2;
export const CANVAS_MAX_SCALE = 12;

type Point = { x: number; y: number };

const clampScale = (value: number) =>
  Math.min(CANVAS_MAX_SCALE, Math.max(CANVAS_MIN_SCALE, value));

const prefersReducedMotion = () =>
  isBrowser &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createCanvasStore() {
  const [scale, setScale] = createSignal(1);
  const [offset, setOffset] = createSignal<Point>({ x: 0, y: 0 });
  const [navHeight, setNavHeight] = createSignal(56);
  const [isPanning, setIsPanning] = createSignal(false);
  const [mouseScreen, setMouseScreen] = createSignal<Point | undefined>(
    undefined
  );

  let frame = 0 as number | undefined;
  // One motion source at a time: view animations and pan inertia share this
  // handle so a new gesture always cancels whatever was still moving.
  let motionFrame = 0;

  const viewTransform = createMemo(() => {
    const t = offset();
    const s = scale();
    return `translate(${t.x}, ${t.y}) scale(${s})`;
  });

  function scheduleTransform() {
    if (!isBrowser) return;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = undefined as unknown as number;
      // Solid's reactivity updates DOM via viewTransform
    });
  }

  function cancelMotion() {
    if (motionFrame && isBrowser) cancelAnimationFrame(motionFrame);
    motionFrame = 0;
  }

  function setView(next: { scale?: number; offset?: Point }) {
    batch(() => {
      if (next.scale !== undefined) setScale(next.scale);
      if (next.offset) setOffset(next.offset);
    });
  }

  /** Zoom by `factor`, keeping the screen point `anchor` fixed under the pointer. */
  function zoomAt(anchor: Point, factor: number) {
    const current = scale();
    const nextScale = clampScale(current * factor);
    if (nextScale === current) return;
    const t = offset();
    const ratio = nextScale / current;
    setView({
      scale: nextScale,
      offset: {
        x: anchor.x - (anchor.x - t.x) * ratio,
        y: anchor.y - (anchor.y - t.y) * ratio,
      },
    });
  }

  function panBy(dx: number, dy: number) {
    const t = offset();
    setOffset({ x: t.x + dx, y: t.y + dy });
  }

  /** Continue a released pan with decaying velocity (px per ms). */
  function startInertia(velocity: Point) {
    cancelMotion();
    if (!isBrowser || prefersReducedMotion()) return;
    let vx = velocity.x;
    let vy = velocity.y;
    if (Math.hypot(vx, vy) < 0.25) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      panBy(vx * dt, vy * dt);
      const decay = Math.pow(0.94, dt / 16);
      vx *= decay;
      vy *= decay;
      if (Math.hypot(vx, vy) < 0.02) {
        motionFrame = 0;
        return;
      }
      motionFrame = requestAnimationFrame(tick);
    };
    motionFrame = requestAnimationFrame(tick);
  }

  function fitToSpread(spread = 1000) {
    if (!isBrowser) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const availH = Math.max(100, vh - navHeight());
    const s = (0.9 * Math.min(vw, availH)) / (2 * spread);
    const screenCx = vw / 2;
    const screenCy = availH / 2;
    setView({
      scale: Math.max(0.2, Math.min(2, s)),
      offset: { x: screenCx, y: screenCy },
    });
    scheduleTransform();
  }

  function animateToView(target: {
    scale: number;
    offset: Point;
    durationMs?: number;
  }) {
    if (!isBrowser) return;
    cancelMotion();
    if (prefersReducedMotion()) {
      setView(target);
      return;
    }
    const startScale = scale();
    const startOffset = offset();
    const durationMs = target.durationMs ?? 320;
    const start = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = easeOutCubic(progress);
      setView({
        scale: startScale + (target.scale - startScale) * eased,
        offset: {
          x: startOffset.x + (target.offset.x - startOffset.x) * eased,
          y: startOffset.y + (target.offset.y - startOffset.y) * eased,
        },
      });
      scheduleTransform();
      motionFrame = progress < 1 ? requestAnimationFrame(tick) : 0;
    };

    motionFrame = requestAnimationFrame(tick);
  }

  /** Animated zoom around a screen point (keyboard and button zoom). */
  function animateZoomAt(anchor: Point, factor: number, durationMs = 180) {
    const current = scale();
    const nextScale = clampScale(current * factor);
    if (nextScale === current) return;
    const t = offset();
    const ratio = nextScale / current;
    animateToView({
      scale: nextScale,
      offset: {
        x: anchor.x - (anchor.x - t.x) * ratio,
        y: anchor.y - (anchor.y - t.y) * ratio,
      },
      durationMs,
    });
  }

  return {
    // state
    scale,
    setScale,
    offset,
    setOffset,
    navHeight,
    setNavHeight,
    isPanning,
    setIsPanning,
    mouseScreen,
    setMouseScreen,
    // derived
    viewTransform,
    // helpers
    scheduleTransform,
    setView,
    zoomAt,
    panBy,
    startInertia,
    cancelMotion,
    fitToSpread,
    animateToView,
    animateZoomAt,
  } as const;
}
