import { createMemo, type Accessor } from "solid-js";
import type { createCanvasStore } from "~/stores/canvas.store";
import type { createPositionsStore } from "~/stores/positions.store";
import type { DocItem } from "~/types/notes";
import { buildKdTree, kdNearest, type KDNode } from "~/spatial/kdtree";

type CanvasStore = ReturnType<typeof createCanvasStore>;
type PositionsStore = ReturnType<typeof createPositionsStore>;
type Point = { x: number; y: number };
type Nearest = { id?: string; dist2?: number };

const NOTE_HOVER_MAX_SCREEN_DIST = 12;
// Fingers are less precise than a cursor, so taps search a wider radius.
const NOTE_TOUCH_MAX_SCREEN_DIST = 22;

export function createHoverDerivations(params: {
  positionsStore: PositionsStore;
  canvasStore: CanvasStore;
  docs: Accessor<DocItem[] | undefined>;
  canHoverNotes?: Accessor<boolean>;
  /** Notes that can be hovered; defaults to the positions store's search-filtered tree. */
  candidateDocs?: Accessor<DocItem[]>;
  coarsePointer?: Accessor<boolean>;
}) {
  const { positionsStore, canvasStore, docs, canHoverNotes } = params;

  const candidateTree = createMemo<KDNode | undefined>(() => {
    const candidates = params.candidateDocs?.();
    if (!candidates) return positionsStore.kdTree();
    const pos = positionsStore.positions();
    const pts: Array<Point & { id: string }> = [];
    for (const doc of candidates) {
      const p = pos.get(doc.id);
      if (p) pts.push({ x: p.x, y: p.y, id: doc.id });
    }
    return buildKdTree(pts);
  });

  const mouseWorld = createMemo<Point | undefined>(() => {
    const s = canvasStore.scale();
    const t = canvasStore.offset();
    const m = canvasStore.mouseScreen();
    if (!m) return undefined;
    return { x: (m.x - t.x) / s, y: (m.y - t.y) / s };
  });

  const nearestToMouse = createMemo<Nearest | undefined>(() => {
    if (canHoverNotes && !canHoverNotes()) return undefined;
    const root = candidateTree();
    const m = mouseWorld();
    if (!root || !m) return undefined;
    return kdNearest(root, m);
  });

  const hoveredScreenDist = createMemo(() => {
    const d2 = nearestToMouse()?.dist2;
    if (d2 === undefined) return Infinity;
    return Math.sqrt(d2) * canvasStore.scale();
  });

  const showHoverLabel = createMemo(
    () =>
      hoveredScreenDist() <=
      (params.coarsePointer?.()
        ? NOTE_TOUCH_MAX_SCREEN_DIST
        : NOTE_HOVER_MAX_SCREEN_DIST)
  );

  const hoveredId = createMemo(() =>
    showHoverLabel() ? nearestToMouse()?.id : undefined
  );

  const hoveredLabelScreen = createMemo(() => {
    const id = hoveredId();
    if (!id) return undefined;
    const pos = positionsStore.positions().get(id);
    if (!pos) return undefined;
    const s = canvasStore.scale();
    const t = canvasStore.offset();
    const title = (docs() || []).find((d) => d.id === id)?.title || id;
    return { x: pos.x * s + t.x, y: pos.y * s + t.y, title };
  });

  return {
    mouseWorld,
    nearestToMouse,
    hoveredId,
    hoveredLabelScreen,
    showHoverLabel,
  } as const;
}
