import dagre from "@dagrejs/dagre";
import type { Point } from "./engine/routing-engine.js";
import {
  ROOT_ID,
  type PathwayGraph as PMap,
  type PathwayNode as PNode,
} from "~/lib/pathways/types";

/** Noise and dropped nodes shrink to one line; important nodes grow. Nothing is hidden. */
export const isFaint = (n: PNode) =>
  n.weight === "noise" || n.status === "dropped";

export function nodeWidth(n: PNode, far = false) {
  if (far) return n.weight === "key" ? 440 : isFaint(n) ? 260 : 360;
  return n.weight === "key" ? 288 : isFaint(n) ? 184 : 232;
}

/**
 * Far-zoom cards hold the title only, sized for about 14px on screen at
 * FAR_K zoom, in two to four lines. Cards with badges keep room for one
 * badge row.
 */
export const FAR_K = 0.4;
export function farHeight(n: PNode) {
  const pad = 6;
  if (isFaint(n)) return 2 * pad + (14 / FAR_K) * 0.8 * 1.2;
  const size = (n.weight === "key" ? 16 : 14) / FAR_K;
  const textW = nodeWidth(n, true) - 2 * (pad + 2);
  // At least two lines, so short titles get the same text size as their neighbours.
  const lines = Math.min(
    4,
    Math.max(2, Math.ceil((n.title.length * size * 0.55) / textW)),
  );
  const badges =
    !!n.feedback || !!n.research || !!n.missed || n.status === "chosen";
  const head = badges ? (10 / FAR_K) * 1.45 + 4 : 0;
  return 2 * pad + head + lines * size * 1.2;
}

/** Card height from text length. The card uses this fixed height, so layout and render agree. */
export function nodeHeight(n: PNode) {
  if (isFaint(n)) return 8 + 12 + 17 + 8;
  const key = n.weight === "key";
  const lineH = key ? 21 : 19;
  const titleLines = Math.min(
    3,
    Math.max(1, Math.ceil(n.title.length / (key ? 30 : 28))),
  );
  const noteLines = n.note
    ? Math.min(2, Math.ceil(n.note.length / (key ? 44 : 36)))
    : 0;
  return (
    12 + 16 + titleLines * lineH + (noteLines ? 6 + noteLines * 16 : 0) + 12
  );
}

export type Box = { x: number; y: number; w: number; h: number };

const RANK_GAP = 96;
const SUB_GAP = 48;
const ROW_GAP = 24;
const LANE_GAP = 40;
const MARGIN = 48;
/** A lane's band reaches this far past its cards. */
const BAND_PAD = 14;
/** Room above the shared band's cards for its label (about 11px on screen). */
const sharedHead = (far: boolean) => (far ? 16 / FAR_K : 22);

/** A horizontal band of related cards: one first-level option and what follows only from it. */
export type Lane = { y: number; h: number; shared: boolean };

/**
 * Layered left-to-right layout, packed to the viewport. Dagre sets each node's
 * layer and order. With lanes, each first-level option and the cards that
 * follow only from it share a horizontal band; cards reached from several
 * options go to a last "where paths meet" band. A tall cell then wraps into
 * extra sub-columns, at the column height that gives the largest scale for a
 * vw x vh viewport.
 */
export type Placed = {
  boxes: Map<string, Box>;
  width: number;
  height: number;
  sig: string;
  lanes: Lane[];
  /** Left and right edge of the lane bands. */
  laneX: [number, number];
};

// Placements by geometry signature: an edit that changes no card size or
// edge (a vote, a note in the far layout) reuses the last placement.
const placeCache = new Map<string, Placed>();

const SPAN = "span";
const SHARED = "shared";

/** Lane key per card, or null when the map has fewer than two first-level options. */
export function assignLanes(map: PMap, y: (id: string) => number) {
  const heads = [
    ...new Set(map.edges.filter((e) => e.from === ROOT_ID).map((e) => e.to)),
  ].sort((a, b) => y(a) - y(b));
  if (heads.length < 2) return null;
  const out = new Map<string, Set<string>>();
  for (const h of heads) {
    const stack = [h];
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id) || id === ROOT_ID) continue;
      seen.add(id);
      if (!out.has(id)) out.set(id, new Set());
      out.get(id)!.add(h);
      for (const e of map.edges) if (e.from === id) stack.push(e.to);
    }
  }
  const lane = new Map<string, string>();
  for (const n of map.nodes) {
    if (n.id === ROOT_ID) lane.set(n.id, SPAN);
    else {
      const o = out.get(n.id);
      lane.set(n.id, o?.size === 1 ? [...o][0] : SHARED);
    }
  }
  return { lane, order: [...heads, SHARED] };
}

export function layoutMap(
  map: PMap,
  vw = 1200,
  vh = 800,
  far = false,
  lanes = true,
): Placed {
  const sizes = map.nodes.map((n) => ({
    n,
    w: nodeWidth(n, far),
    h: far ? farHeight(n) : nodeHeight(n),
    faint: isFaint(n),
  }));
  const sig = [
    far ? "far" : "near",
    lanes ? "lanes" : "flat",
    vw,
    vh,
    sizes
      .map((x) => `${x.n.id}:${x.w}:${Math.round(x.h)}:${x.faint ? 1 : 0}`)
      .join(","),
    map.edges.map((e) => `${e.from}>${e.to}`).join(","),
  ].join("|");
  const hit = placeCache.get(sig);
  if (hit) return hit;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: ROW_GAP, ranksep: RANK_GAP });
  g.setDefaultEdgeLabel(() => ({}));
  for (const x of sizes) g.setNode(x.n.id, { width: x.w, height: x.h });
  const faint = new Set(sizes.filter((x) => x.faint).map((x) => x.n.id));
  for (const e of map.edges)
    if (g.hasNode(e.from) && g.hasNode(e.to)) g.setEdge(e.from, e.to);
  dagre.layout(g);

  type Item = { id: string; y: number; w: number; h: number; rank: number };
  const items: Item[] = g.nodes().map((id) => {
    const n = g.node(id) as {
      x: number;
      y: number;
      width: number;
      height: number;
      rank?: number;
    };
    return { id, y: n.y, w: n.width, h: n.height, rank: n.rank ?? n.x };
  });
  const yOf = new Map(items.map((i) => [i.id, i.y]));
  const laned = lanes ? assignLanes(map, (id) => yOf.get(id) ?? 0) : null;
  const laneOf = (id: string) => laned?.lane.get(id) ?? "all";
  const laneKeys = laned ? laned.order : ["all"];

  // Cells: one per layer and lane, in dagre's top-to-bottom order.
  // Faint nodes go to the top and bottom of their cell, so the rest sits in the middle.
  const rankKeys = [...new Set(items.map((i) => i.rank))].sort((a, b) => a - b);
  const cells = rankKeys.map((r) => {
    const byLane = new Map<string, Item[]>();
    for (const i of items.filter((x) => x.rank === r)) {
      const l = laneOf(i.id);
      if (!byLane.has(l)) byLane.set(l, []);
      byLane.get(l)!.push(i);
    }
    for (const [l, list] of byLane) {
      const sorted = list.sort((a, b) => a.y - b.y);
      const core = sorted.filter((n) => !faint.has(n.id));
      const edge = sorted.filter((n) => faint.has(n.id));
      const half = Math.ceil(edge.length / 2);
      byLane.set(l, [...edge.slice(0, half), ...core, ...edge.slice(half)]);
    }
    return byLane;
  });

  const colHeight = (c: { h: number }[]) =>
    c.reduce((s, n) => s + n.h, 0) + ROW_GAP * Math.max(0, c.length - 1);
  const colWidth = (c: { w: number }[]) => Math.max(0, ...c.map((n) => n.w));
  const wrap = (cell: Item[], limit: number) => {
    const cols: Item[][] = [[]];
    let used = 0;
    for (const n of cell) {
      if (cols.at(-1)!.length && used + ROW_GAP + n.h > limit) {
        cols.push([]);
        used = 0;
      }
      used += (cols.at(-1)!.length ? ROW_GAP : 0) + n.h;
      cols.at(-1)!.push(n);
    }
    return cols;
  };

  const pack = (limit: number) => {
    const ranks = cells.map((byLane) => {
      const span = byLane.get(SPAN) ?? [];
      const lanesHere = new Map(
        [...byLane]
          .filter(([l]) => l !== SPAN)
          .map(([l, cell]) => [l, wrap(cell, limit)]),
      );
      const subs = Math.max(0, ...[...lanesHere.values()].map((c) => c.length));
      const widths = Array.from({ length: subs }, (_, j) =>
        Math.max(0, ...[...lanesHere.values()].map((c) => colWidth(c[j] ?? []))),
      );
      return { span, lanesHere, widths };
    });
    const laneH = new Map(
      laneKeys.map((l) => [
        l,
        Math.max(
          0,
          ...ranks.flatMap((r) => (r.lanesHere.get(l) ?? []).map(colHeight)),
        ),
      ]),
    );
    const active = laneKeys.filter((l) => laneH.get(l)! > 0);
    const lanesTotal =
      active.reduce((s, l) => s + laneH.get(l)!, 0) +
      LANE_GAP * Math.max(0, active.length - 1) +
      (active.length > 1 && active.includes(SHARED) ? sharedHead(far) : 0);
    const contentH = Math.max(
      lanesTotal,
      ...ranks.map((r) => colHeight(r.span)),
    );
    const width =
      ranks.reduce((s, r) => {
        const cols = r.widths.length + (r.span.length ? 1 : 0);
        const w =
          r.widths.reduce((a, b) => a + b, 0) +
          (r.span.length ? colWidth(r.span) : 0);
        return s + w + SUB_GAP * Math.max(0, cols - 1);
      }, 0) +
      RANK_GAP * Math.max(0, ranks.length - 1) +
      2 * MARGIN;
    const height = contentH + 2 * MARGIN;
    return {
      ranks,
      laneH,
      active,
      contentH,
      lanesTotal,
      width,
      height,
      scale: Math.min(vw / width, vh / height),
    };
  };

  // Try column-height limits from one card up to the tallest cell.
  const allCells = cells.flatMap((c) =>
    [...c].filter(([l]) => l !== SPAN).map(([, cell]) => cell),
  );
  const tallest = Math.max(1, ...allCells.map(colHeight));
  const tallestCard = Math.max(1, ...items.map((n) => n.h));
  let best = pack(tallest);
  for (let limit = tallestCard; limit < tallest; limit += 40) {
    const packed = pack(limit);
    if (packed.scale > best.scale + 0.01) best = packed;
  }

  // Lanes stack top to bottom, centred as a block when a spanning card is taller.
  const laneTop = new Map<string, number>();
  let top = MARGIN + (best.contentH - best.lanesTotal) / 2;
  const head = (l: string) =>
    l === SHARED && best.active.length > 1 ? sharedHead(far) : 0;
  for (const l of best.active) {
    top += head(l);
    laneTop.set(l, top);
    top += best.laneH.get(l)! + LANE_GAP;
  }

  const boxes = new Map<string, Box>();
  const placeCol = (col: Item[], x: number, cw: number, y0: number, h: number) => {
    let y = y0 + (h - colHeight(col)) / 2;
    for (const n of col) {
      boxes.set(n.id, { x: x + (cw - n.w) / 2, y, w: n.w, h: n.h });
      y += n.h + ROW_GAP;
    }
  };
  let x = MARGIN;
  let bandL = Infinity;
  let bandR = -Infinity;
  for (const r of best.ranks) {
    if (r.span.length) {
      const cw = colWidth(r.span);
      placeCol(r.span, x, cw, MARGIN, best.contentH);
      x += cw + SUB_GAP;
    }
    r.widths.forEach((cw, j) => {
      for (const [l, cols] of r.lanesHere) {
        if (!cols[j]?.length) continue;
        placeCol(cols[j], x, cw, laneTop.get(l)!, best.laneH.get(l)!);
        bandL = Math.min(bandL, x);
        bandR = Math.max(bandR, x + cw);
      }
      x += cw + SUB_GAP;
    });
    x += RANK_GAP - SUB_GAP;
  }

  const placed: Placed = {
    boxes,
    width: best.width,
    height: best.height,
    sig,
    lanes: laned
      ? best.active.map((l) => ({
          y: laneTop.get(l)! - BAND_PAD - head(l),
          h: best.laneH.get(l)! + 2 * BAND_PAD + head(l),
          shared: l === SHARED,
        }))
      : [],
    laneX: [bandL - BAND_PAD, bandR + BAND_PAD],
  };
  if (placeCache.size > 50) placeCache.clear();
  placeCache.set(sig, placed);
  return placed;
}

/** Router input for the worker (see route.worker.ts). */
export function routeInput(placed: Placed, map: PMap) {
  return {
    nodes: [...placed.boxes].map(([id, b]) => ({
      id,
      ...b,
      shape: "box" as const,
    })),
    groups: [] as never[],
    edges: map.edges
      .filter((e) => placed.boxes.has(e.from) && placed.boxes.has(e.to))
      .map((e) => {
        // Forward edges leave the right side and enter the left side, like the elbows.
        const forward =
          placed.boxes.get(e.to)!.x >
          placed.boxes.get(e.from)!.x + placed.boxes.get(e.from)!.w;
        const cfg = forward
          ? {
              flow: "right" as const,
              fromSide: "right" as const,
              toSide: "left" as const,
            }
          : { flow: "right" as const };
        return {
          id: `${e.from}>${e.to}`,
          from: e.from,
          to: e.to,
          directed: true,
          cfg,
        };
      }),
  };
}

/**
 * Instant stand-ins while the worker routes: right side, across, down, into
 * the left side. Edges leaving the same column each get their own vertical
 * lane in the gap, so they never stack on one line.
 */
export function elbowPaths(placed: Placed, map: PMap) {
  const edges = map.edges
    .map((e) => ({ e, a: placed.boxes.get(e.from), b: placed.boxes.get(e.to) }))
    .filter(
      (x): x is { e: (typeof map.edges)[number]; a: Box; b: Box } =>
        !!x.a && !!x.b,
    );
  // Group by the gap an edge turns in: the right edge of its source column.
  const gaps = new Map<number, typeof edges>();
  for (const x of edges) {
    const key = Math.round(x.a.x + x.a.w);
    if (!gaps.has(key)) gaps.set(key, []);
    gaps.get(key)!.push(x);
  }
  const out = new Map<string, string>();
  for (const [sx, group] of gaps) {
    const right = Math.min(...group.map((x) => x.b.x).filter((tx) => tx > sx));
    const width = Number.isFinite(right) ? right - sx : 48;
    // Top-to-bottom by where the edge ends, so lanes cross as little as possible.
    group.sort(
      (p, q) => p.b.y + p.b.h / 2 - (q.b.y + q.b.h / 2) || p.a.y - q.a.y,
    );
    group.forEach((x, i) => {
      const sy = x.a.y + x.a.h / 2;
      const tx = x.b.x;
      const ty = x.b.y + x.b.h / 2;
      const mx =
        tx > sx
          ? sx + 10 + ((width - 20) * (i + 1)) / (group.length + 1)
          : sx + 24;
      out.set(
        `${x.e.from}>${x.e.to}`,
        roundedPath(
          [
            { x: sx, y: sy },
            { x: mx, y: sy },
            { x: mx, y: ty },
            { x: tx, y: ty },
          ],
          6,
        ),
      );
    });
  }
  return out;
}

/** SVG path through orthogonal points with rounded corners. */
export function roundedPath(points: Point[], radius: number) {
  if (!points.length) return "";
  const dist = (a: Point, b: Point) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const p = points[i];
    const b = points[i + 1];
    const r = b ? Math.min(radius, dist(a, p) / 2, dist(p, b) / 2) : 0;
    if (!b || r === 0) {
      d += `L${p.x},${p.y}`;
      continue;
    }
    const x1 = p.x + Math.sign(a.x - p.x) * r;
    const y1 = p.y + Math.sign(a.y - p.y) * r;
    const x2 = p.x + Math.sign(b.x - p.x) * r;
    const y2 = p.y + Math.sign(b.y - p.y) * r;
    d += `L${x1},${y1}Q${p.x},${p.y} ${x2},${y2}`;
  }
  return d;
}

/** Ids upstream and downstream of a node, for path highlighting. */
export function lineage(map: PMap, id: string) {
  const walk = (start: string, next: (n: string) => string[]) => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length) {
      for (const m of next(stack.pop()!)) {
        if (!seen.has(m)) {
          seen.add(m);
          stack.push(m);
        }
      }
    }
    return seen;
  };
  const up = walk(id, (n) =>
    map.edges.filter((e) => e.to === n).map((e) => e.from),
  );
  const down = walk(id, (n) =>
    map.edges.filter((e) => e.from === n).map((e) => e.to),
  );
  up.add(id);
  down.add(id);
  return { up, down };
}
