export type KDNode = {
  point: { x: number; y: number; id: string };
  left?: KDNode;
  right?: KDNode;
  axis: 0 | 1; // 0=x, 1=y
};

export function buildKdTree(
  points: { x: number; y: number; id: string }[],
  depth = 0
): KDNode | undefined {
  if (points.length === 0) return undefined;
  const axis = (depth % 2) as 0 | 1;
  const sorted = points
    .slice()
    .sort((a, b) => (axis === 0 ? a.x - b.x : a.y - b.y));
  const median = Math.floor(sorted.length / 2);
  return {
    point: sorted[median]!,
    left: buildKdTree(sorted.slice(0, median), depth + 1),
    right: buildKdTree(sorted.slice(median + 1), depth + 1),
    axis,
  };
}

export function kdNearest(
  root: KDNode | undefined,
  target: { x: number; y: number },
  excludeId?: string
): { id?: string; dist2?: number } {
  let bestId: string | undefined;
  let bestDist2 = Infinity;
  function sqr(n: number) {
    return n * n;
  }
  function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
    return sqr(a.x - b.x) + sqr(a.y - b.y);
  }
  function search(node: KDNode | undefined) {
    if (!node) return;
    if (node.point.id !== excludeId) {
      const d2 = dist2(target, node.point);
      if (d2 < bestDist2) {
        bestDist2 = d2;
        bestId = node.point.id;
      }
    }
    const axis = node.axis;
    const diff = axis === 0 ? target.x - node.point.x : target.y - node.point.y;
    const first = diff < 0 ? node.left : node.right;
    const second = diff < 0 ? node.right : node.left;
    search(first);
    if (sqr(diff) < bestDist2) search(second);
  }
  search(root);
  return { id: bestId, dist2: bestDist2 };
}
