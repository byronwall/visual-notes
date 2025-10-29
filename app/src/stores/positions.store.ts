import { createMemo, createSignal, type Accessor } from "solid-js";
import type { DocItem, UmapPoint, UmapRun } from "~/types/notes";
import { normalizeUmap } from "~/layout/umap-normalize";
import { seededPositionFor } from "~/layout/seeded";
import { buildKdTree, type KDNode } from "~/spatial/kdtree";
import { nudgePositions } from "~/layout/nudge";

const SPREAD = 1000;
const NODE_RADIUS = 10;
const MIN_SEP = NODE_RADIUS * 2 + 2; // minimal center distance to avoid overlap

type Point = { x: number; y: number };

export function createPositionsStore(deps: {
  docs: Accessor<DocItem[] | undefined>;
  umapRun: Accessor<UmapRun | undefined>;
  umapPoints: Accessor<UmapPoint[] | undefined>;
  useUmap: Accessor<boolean>;
}) {
  const { docs, umapPoints, useUmap } = deps;

  const umapIndex = createMemo(() => normalizeUmap(umapPoints(), SPREAD));

  const basePositions = createMemo(() => {
    const list = docs();
    const index = umapIndex();
    const preferUmap = useUmap();
    const map = new Map<string, Point>();
    if (!list) return map;
    for (let i = 0; i < list.length; i++) {
      const d = list[i]!;
      const fromUmap = preferUmap ? index.get(d.id) : undefined;
      if (fromUmap) map.set(d.id, fromUmap);
      else map.set(d.id, seededPositionFor(d.title, i, SPREAD));
    }
    return map;
  });

  const [adjustments, setAdjustments] = createSignal(new Map<string, Point>());

  const positions = createMemo(() => {
    const base = basePositions();
    const adj = adjustments();
    if (adj.size === 0) return base;
    const map = new Map<string, Point>();
    for (const [id, p] of base) {
      const d = adj.get(id);
      if (d) map.set(id, { x: p.x + d.x, y: p.y + d.y });
      else map.set(id, p);
    }
    return map;
  });

  const kdTree = createMemo<KDNode | undefined>(() => {
    const list = docs();
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
  const [nudging, setNudging] = createSignal(false);

  async function runNudge(iterations = 200) {
    if (nudging()) return;
    const list = docs() || [];
    if (list.length === 0) return;
    setNudging(true);
    try {
      const startPositions = positions();
      const base = basePositions();
      const { adjustments } = await nudgePositions({
        docs: list,
        startPositions,
        basePositions: base,
        minSeparation: MIN_SEP,
        spread: SPREAD,
        iterations,
      });
      setAdjustments(adjustments);
      setLayoutVersion((v) => v + 1);
      console.log(
        `[positions.store] Nudge complete: adjusted ${adjustments.size} nodes`
      );
    } finally {
      setNudging(false);
    }
  }

  return {
    // memos/signals
    umapIndex,
    basePositions,
    adjustments,
    setAdjustments,
    positions,
    kdTree,
    layoutVersion,
    setLayoutVersion,
    nudging,
    setNudging,
    // actions
    runNudge,
  } as const;
}
