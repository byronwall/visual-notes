import type { PathwayEdge, PathwayGraph, PathwayNode } from "./types";

/** A card as drawn. `after` lists the hidden done cards just before it. */
export type MapNode = PathwayNode & { after?: string[] };
export type MapGraph = { nodes: MapNode[]; edges: PathwayEdge[] };

/**
 * The map as drawn. Hidden dropped cards leave with their edges. Hidden done
 * cards leave too, but each one's parents connect to its children, so a path
 * stays whole when a step in the middle is done. The card after a done card
 * keeps the done titles in `after`.
 */
export function frontier(
  g: PathwayGraph,
  show: { done: boolean; dropped: boolean },
): MapGraph {
  const gone = (n: PathwayNode) =>
    (!show.dropped && n.status === "dropped") ||
    (!show.done && n.status === "done");
  if (!g.nodes.some(gone)) return g;

  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const done = (id: string) =>
    !show.done && byId.get(id)?.status === "done";
  const out = new Map<string, string[]>();
  for (const e of g.edges) {
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    // A hidden dropped card cuts the path, as before.
    if (!from || !to || (!show.dropped && (from.status === "dropped" || to.status === "dropped")))
      continue;
    out.set(e.from, [...(out.get(e.from) ?? []), e.to]);
  }

  const nodes = g.nodes.filter((n) => !gone(n));
  const after = new Map<string, Set<string>>();
  const edges: PathwayEdge[] = [];
  const seen = new Set<string>();
  const link = (from: string, to: string) => {
    const k = `${from}>${to}`;
    if (seen.has(k)) return;
    seen.add(k);
    edges.push({ from, to });
  };
  for (const n of nodes) {
    // Walk through done cards to the next shown cards.
    const stack = (out.get(n.id) ?? []).map((id) => ({ id, trail: [] as string[] }));
    const walked = new Set<string>();
    while (stack.length) {
      const { id, trail } = stack.pop()!;
      if (!done(id)) {
        link(n.id, id);
        if (trail.length) {
          const set = after.get(id) ?? new Set<string>();
          for (const t of trail) set.add(t);
          after.set(id, set);
        }
        continue;
      }
      if (walked.has(id)) continue;
      walked.add(id);
      const t = [...trail, byId.get(id)!.title];
      for (const next of out.get(id) ?? []) stack.push({ id: next, trail: t });
    }
  }
  return {
    nodes: nodes.map((n) =>
      after.has(n.id) ? { ...n, after: [...after.get(n.id)!] } : n,
    ),
    edges,
  };
}
