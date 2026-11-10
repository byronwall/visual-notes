import { ROOT_ID, type PathwayGraph } from "./types";

/**
 * A new map from one card: the card becomes the question, and everything
 * that follows from it comes along with its notes, reactions, and research.
 * Cards that only lead into it stay behind.
 */
export function splitGraph(graph: PathwayGraph, nodeId: string): PathwayGraph {
  const card = graph.nodes.find((n) => n.id === nodeId);
  if (!card) throw new Error(`Card ${nodeId} not found`);
  const keep = new Set<string>();
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const e of graph.edges)
      if (
        e.from === id &&
        e.to !== nodeId &&
        e.to !== ROOT_ID &&
        !keep.has(e.to)
      ) {
        keep.add(e.to);
        stack.push(e.to);
      }
  }
  const root = {
    id: ROOT_ID,
    kind: "root" as const,
    title: card.title,
    note: card.note,
    by: "me" as const,
    status: "open" as const,
    ...(card.research ? { research: card.research } : {}),
  };
  const map = (id: string) => (id === nodeId ? ROOT_ID : id);
  return {
    nodes: [root, ...graph.nodes.filter((n) => keep.has(n.id))],
    edges: graph.edges
      .filter((e) => (e.from === nodeId || keep.has(e.from)) && keep.has(e.to))
      .map((e) => ({ from: map(e.from), to: map(e.to) })),
  };
}
