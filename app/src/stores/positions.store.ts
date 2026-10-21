import { createMemo, createSignal, type Accessor } from "solid-js";
import type { DocItem, UmapPoint, UmapRun } from "~/types/notes";
import { normalizeUmap } from "~/layout/umap-normalize";
import { seededPositionFor } from "~/layout/seeded";
import { placeApproximate } from "~/layout/approximate-placement";
import { buildKdTree, type KDNode } from "~/spatial/kdtree";
import {
  docMatchesCanvasQuery,
  normalizeCanvasQuery,
} from "~/components/visual/canvas-search";

const SPREAD = 1000;
const NODE_RADIUS = 10;
const MIN_SEP = NODE_RADIUS * 2 + 2; // minimal center distance to avoid overlap

/** `approximate` marks a note placed by neighbor guess, not by the map. */
type Point = { x: number; y: number; approximate?: true };

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

    // Without a map there is nothing to be near; seed the whole set.
    if (index.size === 0) {
      list.forEach((d, i) =>
        map.set(d.id, seededPositionFor(d.title, i, SPREAD)),
      );
      return map;
    }

    let unknownCount = 0;
    for (const d of list) {
      const fromUmap = index.get(d.id);
      if (fromUmap) map.set(d.id, fromUmap);
      else unknownCount++;
    }
    if (unknownCount === 0) return map;

    const approximate = placeApproximate({
      docs: list,
      known: map,
      minSep: MIN_SEP,
      spread: SPREAD,
    });
    for (const [id, p] of approximate) map.set(id, p);
    console.debug(
      `[positions.store] placed ${approximate.size} notes without a map point near neighbors`,
    );
    return map;
  });

  // Filtered docs for layout/interaction based on search
  const filteredDocs = createMemo(() => {
    const list = docs() || [];
    const q = normalizeCanvasQuery(deps.searchQuery());
    if (!q) return list;
    return list.filter((d) => docMatchesCanvasQuery(d, q));
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
