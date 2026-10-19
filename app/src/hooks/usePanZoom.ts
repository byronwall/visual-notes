import type { Accessor } from "solid-js";
import type { createCanvasStore } from "~/stores/canvas.store";
import type { createSelectionStore } from "~/stores/selection.store";

const isBrowser = typeof window !== "undefined";

type CanvasStore = ReturnType<typeof createCanvasStore>;
type SelectionStore = ReturnType<typeof createSelectionStore>;
type Point = { x: number; y: number };

type PanZoomOptions = {
  getCanOpen?: Accessor<boolean>;
  getHoveredId?: Accessor<string | undefined>;
  getHoveredRegionId?: Accessor<string | undefined>;
  getPressedRegionId?: Accessor<string | undefined>;
  onOpenDoc?: (id: string) => void;
  onActivateRegion?: (id: string) => void;
  clearPressedRegion?: () => void;
  selection?: SelectionStore;
  /** Keep gliding after a quick pan release. */
  inertia?: boolean;
};

const PAN_THRESHOLD_PX = 6;
const CLICK_TOL_PX = 5;
const CLICK_TOL_MS = 500;
// Mouse wheels report ~100px notches; pinch gestures arrive as ctrl+wheel with
// small deltas, so they need a stronger factor to feel 1:1 with the fingers.
const WHEEL_ZOOM_INTENSITY = 0.0015;
const PINCH_ZOOM_INTENSITY = 0.01;
const VELOCITY_WINDOW_MS = 90;

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

function wheelDeltaPx(e: WheelEvent, value: number) {
  if (e.deltaMode === 1) return value * 16;
  if (e.deltaMode === 2) return value * 400;
  return value;
}

export function createPanZoomHandlers(
  canvasStore: CanvasStore,
  opts: PanZoomOptions = {}
) {
  let lastPan = { x: 0, y: 0 };
  let clickStart: Point | undefined;
  let clickStartTime = 0;
  let isBrushing = false;
  let suppressNextOpen = false;
  let pendingMouseScreen: Point | undefined;
  let mouseFrame = 0;
  let panSamples: Array<{ t: number; x: number; y: number }> = [];

  // Wheel input is coalesced into one view update per frame.
  let wheelFrame = 0;
  let wheelZoomLog = 0;
  let wheelPan = { x: 0, y: 0 };
  let wheelAnchor: Point = { x: 0, y: 0 };

  // Active touch/pen pointers for pinch zoom.
  const pointers = new Map<number, Point>();
  let pinch: { distance: number; mid: Point } | undefined;

  function blockNextOpen() {
    suppressNextOpen = true;
  }

  function scheduleTransform() {
    canvasStore.scheduleTransform();
  }

  function localPoint(e: { clientX: number; clientY: number; currentTarget: EventTarget | null }) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function scheduleMouseScreen(next: Point) {
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

  function flushWheel() {
    wheelFrame = 0;
    if (wheelPan.x || wheelPan.y) {
      canvasStore.panBy(wheelPan.x, wheelPan.y);
    }
    if (wheelZoomLog) {
      canvasStore.zoomAt(wheelAnchor, Math.pow(2, wheelZoomLog));
    }
    wheelZoomLog = 0;
    wheelPan = { x: 0, y: 0 };
    scheduleTransform();
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    canvasStore.cancelMotion();
    const dx = wheelDeltaPx(e, e.deltaX);
    const dy = wheelDeltaPx(e, e.deltaY);
    wheelAnchor = localPoint(e);
    if (e.shiftKey && !e.ctrlKey) {
      // Shift+wheel pans sideways, matching most map and design tools.
      wheelPan.x -= dy || dx;
    } else if (!e.ctrlKey && Math.abs(dx) > Math.abs(dy)) {
      wheelPan.x -= dx;
    } else {
      const intensity = e.ctrlKey ? PINCH_ZOOM_INTENSITY : WHEEL_ZOOM_INTENSITY;
      wheelZoomLog += -dy * intensity;
    }
    if (!isBrowser) {
      flushWheel();
      return;
    }
    if (!wheelFrame) wheelFrame = requestAnimationFrame(flushWheel);
  }

  function beginPinch() {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return;
    pinch = {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
    // A second finger turns the gesture into a pinch, never a click or brush.
    clickStart = undefined;
    canvasStore.setIsPanning(true);
    if (isBrushing) {
      isBrushing = false;
      opts.selection?.endBrush();
    }
  }

  function updatePinch() {
    const [a, b] = [...pointers.values()];
    if (!a || !b || !pinch) return;
    const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    canvasStore.panBy(mid.x - pinch.mid.x, mid.y - pinch.mid.y);
    canvasStore.zoomAt(mid, distance / pinch.distance);
    pinch = { distance, mid };
    scheduleTransform();
  }

  function onPointerDown(e: PointerEvent) {
    const container = e.currentTarget as HTMLElement;
    const { x: localX, y: localY } = localPoint(e);
    canvasStore.cancelMotion();
    try {
      container.setPointerCapture(e.pointerId);
    } catch (_) {}
    if (e.pointerType !== "mouse") {
      pointers.set(e.pointerId, { x: localX, y: localY });
      // Touch has no hover, so resolve the tapped note from the press point.
      canvasStore.setMouseScreen({ x: localX, y: localY });
      if (pointers.size === 2) {
        beginPinch();
        return;
      }
    } else {
      scheduleMouseScreen({ x: localX, y: localY });
    }
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
      clickStartTime = now();
      panSamples = [{ t: clickStartTime, x: localX, y: localY }];
    }
  }

  function onPointerMove(e: PointerEvent) {
    const { x: localX, y: localY } = localPoint(e);
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x: localX, y: localY });
      if (pinch) {
        updatePinch();
        return;
      }
    }
    if (e.pointerType === "mouse") {
      scheduleMouseScreen({ x: localX, y: localY });
    }
    if (isBrushing && opts.selection) {
      opts.selection.updateBrush({ x: localX, y: localY });
      return;
    }
    if (!canvasStore.isPanning()) {
      if (clickStart) {
        const dxFromStart = localX - clickStart.x;
        const dyFromStart = localY - clickStart.y;
        if (Math.hypot(dxFromStart, dyFromStart) >= PAN_THRESHOLD_PX) {
          canvasStore.setIsPanning(true);
          lastPan = { x: localX, y: localY };
        }
      }
      if (!canvasStore.isPanning()) return;
    }
    const dx = localX - lastPan.x;
    const dy = localY - lastPan.y;
    lastPan = { x: localX, y: localY };
    const t = now();
    panSamples.push({ t, x: localX, y: localY });
    while (panSamples.length > 2 && t - panSamples[0]!.t > VELOCITY_WINDOW_MS) {
      panSamples.shift();
    }
    canvasStore.panBy(dx, dy);
    scheduleTransform();
  }

  function releaseVelocity(): Point | undefined {
    const last = panSamples.at(-1);
    const first = panSamples[0];
    if (!last || !first || last === first) return undefined;
    // A pause before release means the user meant to stop here.
    if (now() - last.t > 60) return undefined;
    const dt = last.t - first.t;
    if (dt <= 0) return undefined;
    return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
  }

  function onPointerUp(e: PointerEvent) {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    if (pointers.has(e.pointerId)) {
      pointers.delete(e.pointerId);
      if (pinch) {
        if (pointers.size < 2) {
          pinch = undefined;
          // Continue as a one-finger pan from the remaining pointer.
          const remaining = [...pointers.values()][0];
          if (remaining) lastPan = remaining;
          else canvasStore.setIsPanning(false);
        }
        clickStart = undefined;
        return;
      }
    }
    if (isBrushing && opts.selection) {
      // Finalize brush selection
      opts.selection.commitBrushSelection();
      isBrushing = false;
      return;
    }
    const wasPanning = canvasStore.isPanning();
    canvasStore.setIsPanning(false);
    const { x: localX, y: localY } = localPoint(e);
    if (e.pointerType === "mouse") scheduleMouseScreen({ x: localX, y: localY });

    if (wasPanning && opts.inertia) {
      const velocity = releaseVelocity();
      if (velocity) canvasStore.startInertia(velocity);
    }
    panSamples = [];

    // Bare-click open-nearest behavior (matches previous route logic)
    if (clickStart) {
      const dx = localX - clickStart.x;
      const dy = localY - clickStart.y;
      const dist = Math.hypot(dx, dy);
      const dt = now() - clickStartTime;
      if (e.button === 0 && dist <= CLICK_TOL_PX && dt <= CLICK_TOL_MS) {
        if (!suppressNextOpen) {
          const canOpen = opts.getCanOpen ? opts.getCanOpen() : false;
          const id = opts.getHoveredId ? opts.getHoveredId() : undefined;
          // When a note is the active hover target inside a region, prefer
          // opening the note over re-activating the containing region.
          if (canOpen && id && opts.onOpenDoc) {
            opts.onOpenDoc(id);
            endClick(e);
            return;
          }
        }
        const pressedRegionId = opts.getPressedRegionId?.();
        const hoveredRegionId = opts.getHoveredRegionId?.();
        const regionId = pressedRegionId ?? hoveredRegionId;
        if (regionId && opts.onActivateRegion) {
          opts.onActivateRegion(regionId);
          endClick(e);
          return;
        }
      }
    }
    endClick(e);
  }

  function endClick(e: PointerEvent) {
    opts.clearPressedRegion?.();
    suppressNextOpen = false;
    clickStart = undefined;
    if (e.pointerType !== "mouse") canvasStore.setMouseScreen(undefined);
  }

  function onPointerCancel(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = undefined;
    onPointerLeave();
  }

  function onPointerLeave() {
    pendingMouseScreen = undefined;
    if (mouseFrame && isBrowser) {
      cancelAnimationFrame(mouseFrame);
      mouseFrame = 0;
    }
    canvasStore.setMouseScreen(undefined);
    // Pointer capture keeps a drag alive outside the surface; only a real
    // leave with no pressed pointer should end panning.
    if (pointers.size === 0) canvasStore.setIsPanning(false);
    if (isBrushing) {
      isBrushing = false;
      opts.selection?.endBrush();
    }
    opts.clearPressedRegion?.();
    clickStart = undefined;
  }

  return {
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    blockNextOpen,
  } as const;
}
