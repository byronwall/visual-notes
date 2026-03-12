import { createMemo, createSignal, type Accessor } from "solid-js";
import type { DocItem, UmapPoint, UmapRun } from "~/types/notes";
import { normalizeUmap } from "~/layout/umap-normalize";
import { seededPositionFor } from "~/layout/seeded";
import { buildKdTree, type KDNode } from "~/spatial/kdtree";

const SPREAD = 1000;
const NODE_RADIUS = 10;
const MIN_SEP = NODE_RADIUS * 2 + 2; // minimal center distance to avoid overlap

type Point = { x: number; y: number };

export function createPositionsStore(deps: {
  docs: Accessor<DocItem[] | undefined>;
  umapRun: Accessor<UmapRun | undefined>;
  umapPoints: Accessor<UmapPoint[] | undefined>;
  aspectRatio?: Accessor<number>;
  searchQuery: Accessor<string>;
  // TODO:TYPE_MIRROR, allow extra props for forward-compat
  [key: string]: unknown;
}) {
  const { docs, umapPoints } = deps;

  const umapIndex = createMemo(() => normalizeUmap(umapPoints(), SPREAD));

  const basePositions = createMemo(() => {
    const list = docs();
    const index = umapIndex();
    const map = new Map<string, Point>();
    if (!list) return map;

    const unknown: { id: string; title: string; seeded: Point }[] = [];
    for (let i = 0; i < list.length; i++) {
      const d = list[i]!;
      const fromUmap = index.get(d.id);
      if (fromUmap) {
        map.set(d.id, fromUmap);
      } else {
        const seeded = seededPositionFor(d.title, i, SPREAD);
        unknown.push({ id: d.id, title: d.title, seeded });
      }
    }

    if (unknown.length === 0) {
      return map;
    }

    if (index.size === 0) {
      for (const u of unknown) map.set(u.id, u.seeded);
      return map;
    }

    let minY = Number.POSITIVE_INFINITY;
    for (const p of index.values()) {
      if (p.y < minY) minY = p.y;
    }
    if (!Number.isFinite(minY)) minY = 0;

    // Lay out unknowns in a compact grid centered at x=0, above known minY
    const count = unknown.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cell = MIN_SEP;
    const gridW = cols * cell;
    const gridH = rows * cell;
    const margin = cell * 2;
    const startX = -gridW / 2 + cell / 2;
    const startY = minY - margin - gridH;

    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = startX + c * cell;
      const y = startY + r * cell;
      map.set(unknown[i]!.id, { x, y });
    }

    try {
      console.log(
        `[positions.store] Clustered ${count} unknown points at top-center (startY=${startY.toFixed(
          1
        )})`
      );
    } catch {}

    return map;
  });

  // Filtered docs for layout/interaction based on search
  const filteredDocs = createMemo(() => {
    const list = docs() || [];
    const q = deps.searchQuery().trim().toLowerCase();
    if (!q) return list;
    return list.filter((d) => d.title.toLowerCase().includes(q));
  });

  const positions = createMemo(() => {
    void deps.aspectRatio?.();
    return basePositions();
  });

  const kdTree = createMemo<KDNode | undefined>(() => {
    const list = filteredDocs();
    if (!list) return undefined;
    const pos = positions();
    const pts: { x: number; y: number; id: string }[] = [];
    for (const d of list) {
      const p = pos.get(d.id);
      if (p) pts.push({ x: p.x, y: p.y, id: d.id });
    }
    return buildKdTree(pts);
  });

  const [layoutVersion, setLayoutVersion] = createSignal(0);

  return {
    // memos/signals
    umapIndex,
    basePositions,
    positions,
    kdTree,
    layoutVersion,
    setLayoutVersion,
  } as const;
}
