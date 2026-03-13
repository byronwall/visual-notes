import type { Accessor } from "solid-js";
import type { createCanvasStore } from "~/stores/canvas.store";
import type { createSelectionStore } from "~/stores/selection.store";

const isBrowser = typeof window !== "undefined";

type CanvasStore = ReturnType<typeof createCanvasStore>;
type SelectionStore = ReturnType<typeof createSelectionStore>;

type PanZoomOptions = {
  getCanOpen?: Accessor<boolean>;
  getHoveredId?: Accessor<string | undefined>;
  getHoveredRegionId?: Accessor<string | undefined>;
  getPressedRegionId?: Accessor<string | undefined>;
  onOpenDoc?: (id: string) => void;
  onActivateRegion?: (id: string) => void;
  clearPressedRegion?: () => void;
  selection?: SelectionStore;
};

export function createPanZoomHandlers(
  canvasStore: CanvasStore,
  opts: PanZoomOptions = {}
) {
  let lastPan = { x: 0, y: 0 };
  let clickStart: { x: number; y: number } | undefined;
  let clickStartTime = 0;
  let isBrushing = false;
  let suppressNextOpen = false;
  let pendingMouseScreen: { x: number; y: number } | undefined;
  let mouseFrame = 0;

  function blockNextOpen() {
    suppressNextOpen = true;
  }

  function scheduleTransform() {
    canvasStore.scheduleTransform();
  }

  function scheduleMouseScreen(next: { x: number; y: number }) {
    pendingMouseScreen = next;
    if (!isBrowser) {
      canvasStore.setMouseScreen(next);
      return;
    }
    if (mouseFrame) return;
    mouseFrame = requestAnimationFrame(() => {
      mouseFrame = 0;
      if (!pendingMouseScreen) return;
      canvasStore.setMouseScreen(pendingMouseScreen);
      pendingMouseScreen = undefined;
    });
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
      12,
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
    scheduleMouseScreen({ x: localX, y: localY });
    if (e.shiftKey && opts.selection) {
      // Begin brush selection
      isBrushing = true;
      opts.selection.beginBrush({ x: localX, y: localY });
      canvasStore.setIsPanning(false);
      clickStart = undefined;
    } else {
      // Start in a pending-click state and only enter panning
      // after the pointer moves far enough to feel intentional.
      canvasStore.setIsPanning(false);
      lastPan = { x: localX, y: localY };
      clickStart = { x: localX, y: localY };
      clickStartTime =
        typeof performance !== "undefined" ? performance.now() : Date.now();
    }
  }

  function onPointerMove(e: PointerEvent) {
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    scheduleMouseScreen({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    if (isBrushing && opts.selection) {
      opts.selection.updateBrush({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      return;
    }
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    if (!canvasStore.isPanning()) {
      if (clickStart) {
        const dxFromStart = localX - clickStart.x;
        const dyFromStart = localY - clickStart.y;
        if (Math.hypot(dxFromStart, dyFromStart) >= 6) {
          canvasStore.setIsPanning(true);
          lastPan = { x: localX, y: localY };
        }
      }
      if (!canvasStore.isPanning()) return;
    }
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
    if (isBrushing && opts.selection) {
      // Finalize brush selection
      opts.selection.commitBrushSelection();
      isBrushing = false;
      return;
    }
    canvasStore.setIsPanning(false);
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    scheduleMouseScreen({ x: localX, y: localY });

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
        if (!suppressNextOpen) {
          const canOpen = opts.getCanOpen ? opts.getCanOpen() : false;
          const id = opts.getHoveredId ? opts.getHoveredId() : undefined;
          // When a note is the active hover target inside a region, prefer
          // opening the note over re-activating the containing region.
          if (canOpen && id && opts.onOpenDoc) {
            opts.onOpenDoc(id);
            opts.clearPressedRegion?.();
            suppressNextOpen = false;
            clickStart = undefined;
            return;
          }
        }
        const pressedRegionId = opts.getPressedRegionId?.();
        const hoveredRegionId = opts.getHoveredRegionId?.();
        const regionId = pressedRegionId ?? hoveredRegionId;
        if (regionId && opts.onActivateRegion) {
          opts.onActivateRegion(regionId);
          opts.clearPressedRegion?.();
          suppressNextOpen = false;
          clickStart = undefined;
          return;
        }
      }
    }
    opts.clearPressedRegion?.();
    suppressNextOpen = false;
    clickStart = undefined;
  }

  return {
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    blockNextOpen,
  } as const;
}
