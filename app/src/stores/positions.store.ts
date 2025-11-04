import { createMemo, createSignal, type Accessor } from "solid-js";
import type { DocItem, UmapPoint, UmapRun } from "~/types/notes";
import { normalizeUmap } from "~/layout/umap-normalize";
import { seededPositionFor } from "~/layout/seeded";
import { buildKdTree, type KDNode } from "~/spatial/kdtree";
import { nudgePositions } from "~/layout/nudge";
import {
  assignToGridZOrderSnaked,
  bestFitGridForAspect,
  gridCellCenterWorld,
} from "~/layout/zorder-grid";

const SPREAD = 1000;
const NODE_RADIUS = 10;
const MIN_SEP = NODE_RADIUS * 2 + 2; // minimal center distance to avoid overlap

type Point = { x: number; y: number };

export function createPositionsStore(deps: {
  docs: Accessor<DocItem[] | undefined>;
  umapRun: Accessor<UmapRun | undefined>;
  umapPoints: Accessor<UmapPoint[] | undefined>;
  useUmap: Accessor<boolean>;
  layoutMode?: Accessor<"umap" | "grid">;
  aspectRatio?: Accessor<number>;
  searchQuery: Accessor<string>;
  hideNonMatches: Accessor<boolean>;
  nestByPath?: Accessor<boolean>;
  clusterUnknownTopCenter?: Accessor<boolean>;
  // TODO:TYPE_MIRROR, allow extra props for forward-compat
  [key: string]: unknown;
}) {
  const { docs, umapPoints, useUmap, layoutMode, aspectRatio } = deps;

  const umapIndex = createMemo(() => normalizeUmap(umapPoints(), SPREAD));

  const basePositions = createMemo(() => {
    const list = docs();
    const index = umapIndex();
    const preferUmap = useUmap();
    const clusterUnknown = deps.clusterUnknownTopCenter?.() === true;
    const isUmapLayout = (layoutMode?.() || "umap") === "umap";
    const map = new Map<string, Point>();
    if (!list) return map;

    // First, place all known UMAP points; collect unknowns
    const unknown: { id: string; title: string; seeded: Point }[] = [];
    for (let i = 0; i < list.length; i++) {
      const d = list[i]!;
      const fromUmap = preferUmap ? index.get(d.id) : undefined;
      if (fromUmap) {
        map.set(d.id, fromUmap);
      } else {
        // fallback seeded for deterministic baseline
        const seeded = seededPositionFor(d.title, i, SPREAD);
        unknown.push({ id: d.id, title: d.title, seeded });
      }
    }

    if (
      !preferUmap ||
      !isUmapLayout ||
      !clusterUnknown ||
      unknown.length === 0
    ) {
      // Default behavior: use seeded for unknowns
      for (const u of unknown) map.set(u.id, u.seeded);
      return map;
    }

    // Compute bounds of known UMAP points to place unknowns above them
    let minY = Number.POSITIVE_INFINITY;
    for (const p of index.values()) {
      if (p.y < minY) minY = p.y;
    }
    if (!Number.isFinite(minY)) minY = 0;

    // Lay out unknowns in a compact grid centered at x=0, above known minY
    const count = unknown.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cell = MIN_SEP; // separation to avoid overlaps
    const gridW = cols * cell;
    const gridH = rows * cell;
    const margin = cell * 2;
    const startX = -gridW / 2 + cell / 2; // center around x=0
    const startY = minY - margin - gridH; // fully above known cluster

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

  // Grid positions computed via Z-order space-filling curve and snaked row-major placement
  const gridPositions = createMemo(() => {
    const list = deps.hideNonMatches() ? filteredDocs() : docs() || [];
    const base = basePositions();
    if (list.length === 0) return base;
    const groupEnabled = deps.nestByPath?.() === true;
    // Build an array of points in the same order as docs to preserve id mapping
    const pts: { x: number; y: number; id: string; pathTop: string }[] = [];
    for (const d of list) {
      const p = base.get(d.id);
      if (!p) continue;
      const top = (d as any).path ? String((d as any).path) : "";
      const topSeg = top.split(".").filter(Boolean)[0] || "∅";
      pts.push({ x: p.x, y: p.y, id: d.id, pathTop: topSeg });
    }
    const n = pts.length;
    const aspect = Math.max(0.25, Math.min(4, aspectRatio?.() || 1));
    const [gridW, gridH] = bestFitGridForAspect(n, aspect);
    const cellSize = MIN_SEP;
    const originX = 0;
    const originY = 0;

    if (!groupEnabled) {
      const mapping = assignToGridZOrderSnaked(
        pts.map((p) => ({ x: p.x, y: p.y })),
        gridW,
        gridH
      );
      const out = new Map<string, Point>();
      for (let cell = 0; cell < gridW * gridH; cell++) {
        const idx = mapping[cell]!;
        if (idx == null || idx < 0) continue;
        const center = gridCellCenterWorld(
          cell,
          gridW,
          gridH,
          cellSize,
          originX,
          originY
        );
        const id = pts[idx]!.id;
        out.set(id, center);
      }
      console.log(
        `[positions.store] Grid layout built: ${n} visible pts in ${gridW}x${gridH}, cell=${cellSize}`
      );
      return out;
    }

    // Grouped grid: allocate exclusive regions per top-level path
    const byGroup = new Map<string, { id: string; x: number; y: number }[]>();
    for (const p of pts) {
      const arr = byGroup.get(p.pathTop) || [];
      arr.push({ id: p.id, x: p.x, y: p.y });
      byGroup.set(p.pathTop, arr);
    }
    const groups = Array.from(byGroup.keys()).sort((a, b) =>
      a.localeCompare(b)
    );
    const out = new Map<string, Point>();

    // Simple shelf packing of group rectangles
    let cursorX = 0;
    let cursorY = 0;
    let rowH = 0;
    for (const g of groups) {
      const arr = byGroup.get(g)!;
      // order docs within group by x (UMAP-derived base positions)
      arr.sort((a, b) => a.x - b.x);
      const count = arr.length;
      const [gw, gh] = bestFitGridForAspect(count, aspect);
      if (cursorX + gw > gridW && cursorX > 0) {
        cursorY += rowH;
        cursorX = 0;
        rowH = 0;
      }
      const startX = cursorX;
      const startY = cursorY;
      rowH = Math.max(rowH, gh);
      cursorX += gw;
      // place docs row-major inside group rect
      for (let i = 0; i < count; i++) {
        const lx = i % gw;
        const ly = Math.floor(i / gw);
        const globalCell = (startY + ly) * gridW + (startX + lx);
        const center = gridCellCenterWorld(
          globalCell,
          gridW,
          gridH,
          cellSize,
          originX,
          originY
        );
        const id = arr[i]!.id;
        out.set(id, center);
      }
    }
    console.log(
      `[positions.store] Grouped grid layout: ${groups.length} groups across ${gridW}x${gridH}, cell=${cellSize}`
    );
    return out;
  });

  const [adjustments, setAdjustments] = createSignal(new Map<string, Point>());

  const positions = createMemo(() => {
    const mode = layoutMode?.() || (useUmap() ? "umap" : "umap");
    const base = mode === "grid" ? gridPositions() : basePositions();
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
    const list = deps.hideNonMatches() ? filteredDocs() : docs();
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
