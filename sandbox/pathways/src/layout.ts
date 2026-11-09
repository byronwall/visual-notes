import dagre from "@dagrejs/dagre";
import type { PMap, PNode } from "./types";

export const NODE_W = 232;
const CHARS_PER_LINE = 28;

/** Card height from text length. The card uses this fixed height, so layout and render agree. */
export function nodeHeight(n: PNode) {
  const titleLines = Math.min(3, Math.max(1, Math.ceil(n.title.length / CHARS_PER_LINE)));
  const noteLines = n.note ? Math.min(2, Math.ceil(n.note.length / 36)) : 0;
  return 12 + 16 + titleLines * 19 + (noteLines ? 6 + noteLines * 16 : 0) + 12;
}

export type Box = { x: number; y: number; w: number; h: number };

export function layoutMap(map: PMap) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 16, ranksep: 72, marginx: 48, marginy: 48 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of map.nodes) g.setNode(n.id, { width: NODE_W, height: nodeHeight(n) });
  for (const e of map.edges) if (g.hasNode(e.from) && g.hasNode(e.to)) g.setEdge(e.from, e.to);
  dagre.layout(g);

  const boxes = new Map<string, Box>();
  for (const id of g.nodes()) {
    const n = g.node(id);
    boxes.set(id, { x: n.x - n.width / 2, y: n.y - n.height / 2, w: n.width, h: n.height });
  }
  const graph = g.graph();
  return { boxes, width: graph.width ?? 0, height: graph.height ?? 0 };
}

export function edgePath(a: Box, b: Box) {
  const sx = a.x + a.w;
  const sy = a.y + a.h / 2;
  const tx = b.x;
  const ty = b.y + b.h / 2;
  const dx = Math.max(36, Math.abs(tx - sx) / 2);
  return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
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
  const up = walk(id, (n) => map.edges.filter((e) => e.to === n).map((e) => e.from));
  const down = walk(id, (n) => map.edges.filter((e) => e.from === n).map((e) => e.to));
  up.add(id);
  down.add(id);
  return { up, down };
}

export function inDegree(map: PMap) {
  const deg = new Map<string, number>();
  for (const e of map.edges) deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
  return deg;
}
