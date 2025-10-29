import type { Accessor } from "solid-js";
import type { createCanvasStore } from "~/stores/canvas.store";

const isBrowser = typeof window !== "undefined";

type CanvasStore = ReturnType<typeof createCanvasStore>;

type PanZoomOptions = {
  getCanOpen?: Accessor<boolean>;
  getHoveredId?: Accessor<string | undefined>;
  onOpenDoc?: (id: string) => void;
};

export function createPanZoomHandlers(
  canvasStore: CanvasStore,
  opts: PanZoomOptions = {}
) {
  let lastPan = { x: 0, y: 0 };
  let clickStart: { x: number; y: number } | undefined;
  let clickStartTime = 0;

  function scheduleTransform() {
    canvasStore.scheduleTransform();
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY;
    const zoomIntensity = 0.0015;
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const currentScale = canvasStore.scale();
    const newScale = Math.min(
      4,
      Math.max(0.2, currentScale * Math.pow(2, -delta * zoomIntensity))
    );

    const t = canvasStore.offset();
    const worldXBefore = mouseX - t.x;
    const worldYBefore = mouseY - t.y;
    const worldXAfter = worldXBefore * (newScale / currentScale);
    const worldYAfter = worldYBefore * (newScale / currentScale);
    const dx = worldXBefore - worldXAfter;
    const dy = worldYBefore - worldYAfter;

    canvasStore.setScale(newScale);
    canvasStore.setOffset({ x: t.x + dx, y: t.y + dy });
    scheduleTransform();
  }

  function onPointerDown(e: PointerEvent) {
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    container.setPointerCapture(e.pointerId);
    canvasStore.setIsPanning(true);
    lastPan = { x: localX, y: localY };
    canvasStore.setMouseScreen({ x: localX, y: localY });
    clickStart = { x: localX, y: localY };
    clickStartTime =
      typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  function onPointerMove(e: PointerEvent) {
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    canvasStore.setMouseScreen({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    if (!canvasStore.isPanning()) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const dx = localX - lastPan.x;
    const dy = localY - lastPan.y;
    lastPan = { x: localX, y: localY };
    const t = canvasStore.offset();
    canvasStore.setOffset({ x: t.x + dx, y: t.y + dy });
    scheduleTransform();
  }

  function onPointerUp(e: PointerEvent) {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    canvasStore.setIsPanning(false);
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    canvasStore.setMouseScreen({ x: localX, y: localY });

    // Bare-click open-nearest behavior (matches previous route logic)
    const CLICK_TOL_PX = 5;
    const CLICK_TOL_MS = 500;
    if (clickStart) {
      const dx = localX - clickStart.x;
      const dy = localY - clickStart.y;
      const dist = Math.hypot(dx, dy);
      const dt =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        clickStartTime;
      if (
        (e as any).button === 0 &&
        dist <= CLICK_TOL_PX &&
        dt <= CLICK_TOL_MS
      ) {
        const canOpen = opts.getCanOpen ? opts.getCanOpen() : false;
        const id = opts.getHoveredId ? opts.getHoveredId() : undefined;
        if (canOpen && id && opts.onOpenDoc) opts.onOpenDoc(id);
      }
    }
    clickStart = undefined;
  }

  return { onWheel, onPointerDown, onPointerMove, onPointerUp } as const;
}
