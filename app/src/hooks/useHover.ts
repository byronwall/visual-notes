import { createMemo, type Accessor } from "solid-js";
import type { createCanvasStore } from "~/stores/canvas.store";
import type { createPositionsStore } from "~/stores/positions.store";
import type { DocItem } from "~/types/notes";
import { kdNearest } from "~/spatial/kdtree";

type CanvasStore = ReturnType<typeof createCanvasStore>;
type PositionsStore = ReturnType<typeof createPositionsStore>;
const NOTE_HOVER_MAX_SCREEN_DIST = 12;

export function createHoverDerivations(params: {
  positionsStore: PositionsStore;
  canvasStore: CanvasStore;
  docs: Accessor<DocItem[] | undefined>;
  canHoverNotes?: Accessor<boolean>;
  visibleDocIds?: Accessor<Set<string> | null>;
}) {
  const { positionsStore, canvasStore, docs, canHoverNotes, visibleDocIds } =
    params;

  const mouseWorld = createMemo(() => {
    const s = canvasStore.scale();
    const t = canvasStore.offset();
    const m = canvasStore.mouseScreen();
    if (!m)
      return undefined as unknown as {
        x: number;
        y: number;
      };
    return { x: (m.x - t.x) / s, y: (m.y - t.y) / s };
  });

  const nearestToMouse = createMemo(() => {
    if (canHoverNotes && !canHoverNotes()) {
      return undefined as unknown as { id?: string; dist2?: number };
    }
    const root = positionsStore.kdTree();
    const m = mouseWorld();
    if (!root || !m)
      return undefined as unknown as { id?: string; dist2?: number };
    const nearest = kdNearest(root, m);
    const id = nearest?.id;
    if (!id) return nearest;
    const visible = visibleDocIds?.();
    if (visible && !visible.has(id)) {
      return undefined as unknown as { id?: string; dist2?: number };
    }
    return nearest;
  });

  const hoveredScreenDist = createMemo(() => {
    const d2 = nearestToMouse()?.dist2;
    if (d2 === undefined) return Infinity;
    const s = canvasStore.scale();
    return Math.sqrt(d2) * s;
  });
  const hoveredId = createMemo(() =>
    hoveredScreenDist() <= NOTE_HOVER_MAX_SCREEN_DIST
      ? nearestToMouse()?.id
      : undefined
  );

  const showHoverLabel = createMemo(
    () => hoveredScreenDist() <= NOTE_HOVER_MAX_SCREEN_DIST
  );

  const hoveredLabelScreen = createMemo(() => {
    if (!showHoverLabel())
      return undefined as unknown as {
        x: number;
        y: number;
        title: string;
      };
    const id = hoveredId();
    if (!id)
      return undefined as unknown as { x: number; y: number; title: string };
    const pos = positionsStore.positions().get(id);
    if (!pos)
      return undefined as unknown as { x: number; y: number; title: string };
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
