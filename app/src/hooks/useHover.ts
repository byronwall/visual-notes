import { createMemo, type Accessor } from "solid-js";
import type { createCanvasStore } from "~/stores/canvas.store";
import type { createPositionsStore } from "~/stores/positions.store";
import type { DocItem } from "~/types/notes";
import { kdNearest } from "~/spatial/kdtree";

type CanvasStore = ReturnType<typeof createCanvasStore>;
type PositionsStore = ReturnType<typeof createPositionsStore>;

export function createHoverDerivations(params: {
  positionsStore: PositionsStore;
  canvasStore: CanvasStore;
  docs: Accessor<DocItem[] | undefined>;
}) {
  const { positionsStore, canvasStore, docs } = params;

  const mouseWorld = createMemo(() => {
    const s = canvasStore.scale();
    const t = canvasStore.offset();
    const m = canvasStore.mouseScreen();
    return { x: (m.x - t.x) / s, y: (m.y - t.y) / s };
  });

  const nearestToMouse = createMemo(() => {
    const root = positionsStore.kdTree();
    const m = mouseWorld();
    if (!root) return undefined as unknown as { id?: string; dist2?: number };
    return kdNearest(root, m);
  });

  const hoveredId = createMemo(() => nearestToMouse()?.id);
  const hoveredScreenDist = createMemo(() => {
    const d2 = nearestToMouse()?.dist2;
    if (d2 === undefined) return Infinity;
    const s = canvasStore.scale();
    return Math.sqrt(d2) * s;
  });

  const showHoverLabel = createMemo(() => hoveredScreenDist() < 48);

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
