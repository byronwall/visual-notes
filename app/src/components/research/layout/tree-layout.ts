import type { FoldHull, FoldNode, FoldView } from "./fold";

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

export type TreeLayout = {
  rects: Map<string, Rect>;
  bounds: Rect;
};

export const layoutTree = (
  view: Pick<FoldView, "nodes" | "children"> & Partial<Pick<FoldView, "hulls">>,
  nudges: Map<string, { x: number; y: number }> = new Map(),
): TreeLayout => {
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
  const colX = (depth: number) => depth * (CARD_W + COL_GAP);
  const rects = new Map<string, Rect>();

  const place = (id: string, depth: number, top: number, trail: Set<string>): number => {
    const size = sizes.get(id)!;
    const kids = trail.has(id) ? [] : (view.children.get(id) ?? []).filter((kid) => nodeById.has(kid));
    trail.add(id);
    if (!kids.length) {
      rects.set(id, { x: colX(depth), y: top, ...size });
      return top + size.h + ROW_GAP;
    }
    let cursor = top;
    const seen = new Set(hullsOfNode.get(id) ?? []);
    for (const kid of kids) cursor = place(kid, depth + 1, cursor + gapFor(kid, seen), trail);
    const bandBottom = cursor - ROW_GAP;
    const y = Math.max(top, (top + bandBottom) / 2 - size.h / 2);
    rects.set(id, { x: colX(depth), y, ...size });
    return Math.max(cursor, y + size.h + ROW_GAP);
  };

  let cursor = 0;
  const trail = new Set<string>();
  const seenAtRoot = new Set<string>();
  for (const root of view.children.get(null) ?? []) {
    if (!nodeById.has(root)) continue;
    cursor = place(root, 0, cursor + gapFor(root, seenAtRoot), trail) + ROOT_GAP - ROW_GAP;
  }

  for (const [id, nudge] of nudges) {
    const rect = rects.get(id);
    if (rect) rects.set(id, { ...rect, x: rect.x + nudge.x, y: rect.y + nudge.y });
  }

  return { rects, bounds: boundsOf([...rects.values()]) };
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
export const hullRect = (hull: FoldHull, rects: Map<string, Rect>): Rect | null => {
  const members = hull.memberNodeIds.map((id) => rects.get(id)).filter((rect): rect is Rect => !!rect);
  if (!members.length) return null;
  const box = boundsOf(members);
  const pad = 8 + hull.innerCount * 8;
  return {
    x: box.x - pad,
    y: box.y - pad - HULL_LABEL_H,
    w: box.w + pad * 2,
    h: box.h + pad * 2 + HULL_LABEL_H,
  };
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
