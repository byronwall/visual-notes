// A radial layout for a focused network: the focus at the center, direct
// relationships on the first ring, second-hop people on the outer ring near
// the person who connects them.

export type NetPerson = { id: string; displayName: string; hops: number };
export type NetEdge = { id: string; from: string; to: string; label: string };
export type PlacedPerson = NetPerson & { x: number; y: number };

const RING = [0, 190, 360];

export function radialLayout(
  people: NetPerson[],
  edges: NetEdge[],
  centerId: string,
) {
  const placed = new Map<string, PlacedPerson>();
  const center = people.find((p) => p.id === centerId);
  if (center) placed.set(center.id, { ...center, x: 0, y: 0 });

  const ring1 = people
    .filter((p) => p.hops === 1)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const angleOf = new Map<string, number>();
  ring1.forEach((p, i) => {
    const angle = (i / Math.max(1, ring1.length)) * Math.PI * 2 - Math.PI / 2;
    angleOf.set(p.id, angle);
    placed.set(p.id, {
      ...p,
      x: Math.cos(angle) * RING[1],
      y: Math.sin(angle) * RING[1],
    });
  });

  // Each outer person sits near the first ring-1 person who links to them.
  const parent = (id: string) => {
    for (const e of edges) {
      const other = e.from === id ? e.to : e.to === id ? e.from : null;
      if (other && angleOf.has(other)) return other;
    }
    return null;
  };
  const ring2 = people
    .filter((p) => p.hops === 2)
    .map((p) => ({ p, angle: angleOf.get(parent(p.id) ?? "") ?? 0 }))
    .sort(
      (a, b) =>
        a.angle - b.angle || a.p.displayName.localeCompare(b.p.displayName),
    );
  ring2.forEach(({ p }, i) => {
    const angle =
      (i / Math.max(1, ring2.length)) * Math.PI * 2 -
      Math.PI / 2 +
      Math.PI / Math.max(4, ring2.length);
    placed.set(p.id, {
      ...p,
      x: Math.cos(angle) * RING[2],
      y: Math.sin(angle) * RING[2],
    });
  });

  const nodes = [...placed.values()];
  const pad = 90;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(0, ...xs) - pad;
  const minY = Math.min(0, ...ys) - pad / 2;
  return {
    nodes,
    byId: placed,
    bounds: {
      x: minX,
      y: minY,
      w: Math.max(0, ...xs) + pad - minX,
      h: Math.max(0, ...ys) + pad / 2 - minY,
    },
  };
}
