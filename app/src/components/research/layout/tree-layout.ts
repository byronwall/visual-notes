import type { ResearchCardType } from "~/services/research/research.types";
import type { FoldHull, FoldNode, FoldView } from "./fold";
import { SECTION_MIN, sectionByType } from "./sections";

/**
 * Left-to-right tidy tree in base units. Depth sets the column; each subtree
 * takes a vertical band and its parent centers on that band. Saved nudges
 * shift a card after layout, so they survive structure changes.
 */

export type Rect = { x: number; y: number; w: number; h: number };

export const CARD_W = 248;
export const SUMMARY_W = 288;
const COL_GAP = 72;
const ROW_GAP = 14;
const ROOT_GAP = 40;
const LINE_H = 18;
const CHARS_PER_LINE = 32;
export const HULL_LABEL_H = 24;
const HULL_GAP = HULL_LABEL_H + 16;

/** Fixed card height from content, so rendering can never overlap neighbors. */
export const estimateSize = (node: Pick<FoldNode, "card" | "kind">): { w: number; h: number } => {
  const { card } = node;
  const summary = node.kind === "summary";
  const w = summary ? SUMMARY_W : CARD_W;
  const perLine = summary ? CHARS_PER_LINE + 5 : CHARS_PER_LINE;
  const titleLines = Math.min(3, Math.max(1, Math.ceil(card.title.length / perLine)));
  let h = 16 + titleLines * LINE_H;
  if (summary) h += card.body ? 4 * 16 + 6 : 0;
  else if (card.body || card.snippet) h += 2 * 16 + 4;
  if (card.url) h += 18;
  if (card.imageUrl && !summary) h += 72;
  if (summary) h += 20; // covers / open meta row
  return { w, h };
};

export type LaneLabel = {
  /** Came-from parent whose children this section lists. */
  parentId: string;
  type: ResearchCardType;
  count: number;
  memberIds: string[];
  /** The block's first label, where the parent's single came-from edge lands. */
  first: boolean;
  rect: Rect;
};

export type TreeLayout = {
  rects: Map<string, Rect>;
  bounds: Rect;
  lanes: LaneLabel[];
  /** Children listed under a lane label; they share the block's edge instead of drawing their own. */
  laned: Set<string>;
};

export const LANE_LABEL_H = 22;
const LANE_GAP = 40;

export const layoutTree = (
  view: Pick<FoldView, "nodes" | "children"> & Partial<Pick<FoldView, "hulls">>,
  nudges: Map<string, { x: number; y: number }> = new Map(),
  options: { wrapHeight?: number } = {},
): TreeLayout => {
  const wrapHeight = options.wrapHeight ?? Number.POSITIVE_INFINITY;
  const nodeById = new Map(view.nodes.map((node) => [node.id, node]));

  // Reserve label room above the first band where each hull begins.
  const hullsOfNode = new Map<string, string[]>();
  for (const hull of view.hulls ?? []) {
    for (const id of hull.memberNodeIds) hullsOfNode.set(id, [...(hullsOfNode.get(id) ?? []), hull.groupId]);
  }
  const subtreeHulls = new Map<string, Set<string>>();
  const hullsUnder = (id: string, trail = new Set<string>()): Set<string> => {
    const known = subtreeHulls.get(id);
    if (known) return known;
    const out = new Set(hullsOfNode.get(id) ?? []);
    if (!trail.has(id)) {
      trail.add(id);
      for (const kid of view.children.get(id) ?? []) for (const h of hullsUnder(kid, trail)) out.add(h);
    }
    subtreeHulls.set(id, out);
    return out;
  };
  const gapFor = (id: string, seen: Set<string>) => {
    const starting = [...hullsUnder(id)].some((hull) => !seen.has(hull));
    for (const hull of hullsUnder(id)) seen.add(hull);
    return starting ? HULL_GAP : 0;
  };
  const sizes = new Map(view.nodes.map((node) => [node.id, estimateSize(node)]));
  const rects = new Map<string, Rect>();
  const lanes: LaneLabel[] = [];
  const laned = new Set<string>();
  // Placement order, so a subtree placed past the wrap height can be moved whole.
  const placed: string[] = [];

  type Extent = { bottom: number; right: number };

  const shift = (fromPlaced: number, fromLane: number, dx: number, dy: number) => {
    for (const id of placed.slice(fromPlaced)) {
      const rect = rects.get(id)!;
      rects.set(id, { ...rect, x: rect.x + dx, y: rect.y + dy });
    }
    for (const lane of lanes.slice(fromLane)) lane.rect = { ...lane.rect, x: lane.rect.x + dx, y: lane.rect.y + dy };
  };

  /**
   * Many children read badly as one tall column. Split them into type sections
   * that flow down and across columns no taller than `wrapHeight`; each hull
   * cluster starts a fresh column so hull boxes never take in other cards.
   */
  const placeLanes = (
    parentId: string,
    kids: string[],
    x: number,
    top: number,
    trail: Set<string>,
    seen: Set<string>,
  ): Extent => {
    const clusters: string[][] = [];
    const clusterIndex = new Map<string, number>();
    for (const kid of kids) {
      const key = hullsOfNode.get(kid)?.[0] ?? "";
      if (!clusterIndex.has(key)) {
        clusterIndex.set(key, clusters.length);
        clusters.push([]);
      }
      clusters[clusterIndex.get(key)!].push(kid);
    }
    const blockTop = top + (kids.some((kid) => [...hullsUnder(kid)].some((hull) => !seen.has(hull))) ? HULL_GAP : 0);
    for (const kid of kids) for (const hull of hullsUnder(kid)) seen.add(hull);
    const limit = blockTop + wrapHeight;

    let colX = x;
    let colRight = x;
    let cursor = blockTop;
    let bottom = blockTop;
    let first = true;
    const newColumn = () => {
      colX = colRight + LANE_GAP;
      colRight = colX;
      cursor = blockTop;
    };

    clusters.forEach((cluster, clusterNo) => {
      if (clusterNo > 0) newColumn();
      for (const section of sectionByType(cluster, (id) => nodeById.get(id)!.card.type)) {
        // A label never sits alone at the foot of a column.
        const firstSize = sizes.get(section.items[0])!;
        if (cursor > blockTop && cursor + LANE_LABEL_H + firstSize.h > limit) newColumn();
        const lane: LaneLabel = {
          parentId,
          type: section.type,
          count: section.items.length,
          memberIds: section.items,
          first,
          rect: { x: colX, y: cursor, w: CARD_W, h: LANE_LABEL_H },
        };
        first = false;
        lanes.push(lane);
        cursor += LANE_LABEL_H;
        section.items.forEach((kid, index) => {
          laned.add(kid);
          const placedAt = placed.length;
          // The section's first card takes its label along when it moves.
          const laneAt = index === 0 ? lanes.length - 1 : lanes.length;
          const startY = index === 0 ? lane.rect.y : cursor;
          let extent = place(kid, colX, cursor + gapFor(kid, seen), trail);
          if (extent.bottom - ROW_GAP > limit && startY > blockTop) {
            const fromX = colX;
            newColumn();
            const dx = colX - fromX;
            const dy = blockTop - startY;
            shift(placedAt, laneAt, dx, dy);
            extent = { bottom: extent.bottom + dy, right: extent.right + dx };
          }
          cursor = extent.bottom;
          colRight = Math.max(colRight, extent.right);
          bottom = Math.max(bottom, cursor);
        });
      }
    });
    return { bottom, right: colRight };
  };

  const place = (id: string, x: number, top: number, trail: Set<string>): Extent => {
    const size = sizes.get(id)!;
    const kids = trail.has(id) ? [] : (view.children.get(id) ?? []).filter((kid) => nodeById.has(kid));
    trail.add(id);
    placed.push(id);
    if (!kids.length) {
      rects.set(id, { x, y: top, ...size });
      return { bottom: top + size.h + ROW_GAP, right: x + size.w };
    }
    const kidX = x + size.w + COL_GAP;
    const seen = new Set(hullsOfNode.get(id) ?? []);
    let band: Extent;
    if (kids.length > SECTION_MIN) band = placeLanes(id, kids, kidX, top, trail, seen);
    else {
      band = { bottom: top, right: x + size.w };
      for (const kid of kids) {
        const extent = place(kid, kidX, band.bottom + gapFor(kid, seen), trail);
        band = { bottom: extent.bottom, right: Math.max(band.right, extent.right) };
      }
    }
    const bandBottom = band.bottom - ROW_GAP;
    const y = Math.max(top, (top + bandBottom) / 2 - size.h / 2);
    rects.set(id, { x, y, ...size });
    return { bottom: Math.max(band.bottom, y + size.h + ROW_GAP), right: Math.max(band.right, x + size.w) };
  };

  let cursor = 0;
  const trail = new Set<string>();
  const seenAtRoot = new Set<string>();
  for (const root of view.children.get(null) ?? []) {
    if (!nodeById.has(root)) continue;
    cursor = place(root, 0, cursor + gapFor(root, seenAtRoot), trail).bottom + ROOT_GAP - ROW_GAP;
  }

  for (const [id, nudge] of nudges) {
    const rect = rects.get(id);
    if (rect) rects.set(id, { ...rect, x: rect.x + nudge.x, y: rect.y + nudge.y });
  }

  return { rects, bounds: boundsOf([...rects.values(), ...lanes.map((lane) => lane.rect)]), lanes, laned };
};

/** Wrap heights tried when matching the viewport; Infinity keeps one column per section. */
const WRAP_CANDIDATES = [360, 480, 640, 820, 1040, 1320, 1700, 2200, Number.POSITIVE_INFINITY];

/**
 * Lay out at the wrap height whose bounds best match the viewport's shape, so
 * a branch with twenty children fills a wide screen instead of a thin column.
 */
export const layoutForAspect = (
  view: Pick<FoldView, "nodes" | "children"> & Partial<Pick<FoldView, "hulls">>,
  nudges: Map<string, { x: number; y: number }>,
  aspect: number,
): TreeLayout => {
  let best: { layout: TreeLayout; miss: number } | null = null;
  for (const wrapHeight of WRAP_CANDIDATES) {
    const layout = layoutTree(view, nudges, { wrapHeight });
    const { w, h } = layout.bounds;
    if (!w || !h) return layout;
    const miss = Math.abs(Math.log(w / h / aspect));
    if (!best || miss < best.miss - 0.01) best = { layout, miss };
    if (!layout.lanes.length) break;
  }
  return best!.layout;
};

export const boundsOf = (rects: Rect[]): Rect => {
  if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 };
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

/** Padded bounding box around a hull's member cards, with room for its label. */
export const hullRect = (hull: FoldHull, rects: Map<string, Rect>, lanes: LaneLabel[] = []): Rect | null => {
  const inHull = new Set(hull.memberNodeIds);
  const members = [
    ...hull.memberNodeIds.map((id) => rects.get(id)).filter((rect): rect is Rect => !!rect),
    // Section labels over hull members sit inside the hull, under its own label.
    ...lanes.filter((lane) => lane.memberIds.some((id) => inHull.has(id))).map((lane) => lane.rect),
  ];
  if (!members.length) return null;
  const box = boundsOf(members);
  const pad = 8 + hull.innerCount * 8;
  return { x: box.x - pad, y: box.y - pad - HULL_LABEL_H, w: box.w + pad * 2, h: box.h + pad * 2 + HULL_LABEL_H };
};

/** Edge anchor points: right edge middle of the parent to left edge middle of the child. */
export const edgePath = (from: Rect, to: Rect) => {
  const forward = to.x >= from.x + from.w;
  const x1 = forward ? from.x + from.w : from.x + from.w / 2;
  const y1 = forward ? from.y + from.h / 2 : from.y + from.h;
  const x2 = forward ? to.x : to.x + to.w / 2;
  const y2 = forward ? to.y + to.h / 2 : to.y;
  if (forward) {
    const mid = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  }
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
};
