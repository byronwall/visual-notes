import { createMemo, createSignal } from "solid-js";

const isBrowser = typeof window !== "undefined";

export function createCanvasStore() {
  const [scale, setScale] = createSignal(1);
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });
  const [navHeight, setNavHeight] = createSignal(56);
  const [isPanning, setIsPanning] = createSignal(false);
  const [mouseScreen, setMouseScreen] = createSignal({ x: 0, y: 0 });
  const [useUmap, setUseUmap] = createSignal(true);
  const [layoutMode, setLayoutMode] = createSignal<"umap" | "grid">("umap");
  const [clusterUnknownTopCenter, setClusterUnknownTopCenter] =
    createSignal(true);

  let frame = 0 as number | undefined;

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

  function fitToSpread(spread = 1000) {
    if (!isBrowser) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const availH = Math.max(100, vh - navHeight());
    const s = (0.9 * Math.min(vw, availH)) / (2 * spread);
    const screenCx = vw / 2;
    const screenCy = navHeight() + availH / 2;
    setScale(Math.max(0.2, Math.min(2, s)));
    setOffset({ x: screenCx, y: screenCy });
    scheduleTransform();
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
    useUmap,
    setUseUmap,
    layoutMode,
    setLayoutMode,
    clusterUnknownTopCenter,
    setClusterUnknownTopCenter,
    // derived
    viewTransform,
    // helpers
    scheduleTransform,
    fitToSpread,
  } as const;
}
