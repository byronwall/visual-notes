import { createMemo, createSignal } from "solid-js";

type Point = { x: number; y: number };

export type SelectionRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type SelectionBreadcrumb = {
  ids: string[];
  label?: string;
};

export function createSelectionStore(params: {
  getScale: () => number;
  getOffset: () => { x: number; y: number };
  getPositions: () => Map<string, Point>;
}) {
  const { getScale, getOffset, getPositions } = params;

  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(
    new Set<string>()
  );
  const [isBrushing, setIsBrushing] = createSignal(false);
  const [brushStartWorld, setBrushStartWorld] = createSignal<Point | null>(
    null
  );
  const [brushEndWorld, setBrushEndWorld] = createSignal<Point | null>(null);
  const [breadcrumbs, setBreadcrumbs] = createSignal<SelectionBreadcrumb[]>([]);

  const brushRect = createMemo<SelectionRect | null>(() => {
    const a = brushStartWorld();
    const b = brushEndWorld();
    if (!a || !b) return null;
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x, b.x);
    const maxY = Math.max(a.y, b.y);
    return { minX, minY, maxX, maxY };
  });

  const brushRectScreen = createMemo<SelectionRect | null>(() => {
    const r = brushRect();
    if (!r) return null;
    const s = getScale();
    const t = getOffset();
    return {
      minX: r.minX * s + t.x,
      minY: r.minY * s + t.y,
      maxX: r.maxX * s + t.x,
      maxY: r.maxY * s + t.y,
    };
  });

  function screenToWorld(p: Point): Point {
    const s = getScale();
    const t = getOffset();
    return { x: (p.x - t.x) / s, y: (p.y - t.y) / s };
  }

  function beginBrush(screenPoint: Point) {
    const w = screenToWorld(screenPoint);
    setBrushStartWorld(w);
    setBrushEndWorld(w);
    setIsBrushing(true);
    try {
      console.log("[selection] beginBrush", { w });
    } catch {}
  }

  function updateBrush(screenPoint: Point) {
    if (!isBrushing()) return;
    const w = screenToWorld(screenPoint);
    setBrushEndWorld(w);
  }

  function endBrush() {
    setIsBrushing(false);
  }

  function setSelection(ids: string[]) {
    setSelectedIds(new Set<string>(ids));
    try {
      console.log(`[selection] setSelection count=${ids.length}`);
    } catch {}
  }

  function clearSelection() {
    setSelectedIds(new Set<string>());
  }

  function computeIdsInBrush(): string[] {
    const r = brushRect();
    if (!r) return [];
    const pos = getPositions();
    const out: string[] = [];
    for (const [id, p] of pos) {
      if (p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY) {
        out.push(id);
      }
    }
    return out;
  }

  function commitBrushSelection() {
    const ids = computeIdsInBrush();
    setSelection(ids);
    setIsBrushing(false);
    setBrushStartWorld(null);
    setBrushEndWorld(null);
  }

  function isolateSelection(label?: string) {
    const ids = Array.from(selectedIds());
    if (ids.length === 0) return;
    setBreadcrumbs((prev) => [...prev, { ids, label }]);
    // After isolating, keep the selection as-is for further refinement
  }

  function popIsolationTo(index: number) {
    const arr = breadcrumbs();
    if (index < 0 || index >= arr.length) return;
    const next = arr.slice(0, index + 1);
    setBreadcrumbs(next);
  }

  function popIsolation() {
    const arr = breadcrumbs();
    if (arr.length === 0) return;
    const next = arr.slice(0, -1);
    setBreadcrumbs(next);
  }

  function clearIsolation() {
    setBreadcrumbs([]);
  }

  const isolatedIdSet = createMemo<Set<string> | null>(() => {
    const crumbs = breadcrumbs();
    if (crumbs.length === 0) return null;
    // Only render items in the last breadcrumb
    return new Set<string>(crumbs[crumbs.length - 1]!.ids);
  });

  function isSelected(id: string): boolean {
    return selectedIds().has(id);
  }

  return {
    // state
    selectedIds,
    isBrushing,
    brushRect,
    brushRectScreen,
    breadcrumbs,
    isolatedIdSet,
    // actions
    beginBrush,
    updateBrush,
    endBrush,
    commitBrushSelection,
    setSelection,
    clearSelection,
    isolateSelection,
    popIsolation,
    popIsolationTo,
    clearIsolation,
    isSelected,
  } as const;
}
