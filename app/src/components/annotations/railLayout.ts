// Places margin notes beside their passages, the way comments sit in a
// document editor: each note wants to start at its passage's top; notes that
// would overlap are pushed apart. The active note keeps its exact spot and
// the others make room above and below it.

export type RailItem = {
  id: string;
  /** Where the passage starts, relative to the rail's top. */
  want: number;
  height: number;
};

export function layoutRail(
  items: RailItem[],
  activeId: string | null,
  gap = 6,
  floor = 0,
): Map<string, number> {
  const out = new Map<string, number>();
  if (items.length === 0) return out;
  const sorted = [...items].sort((a, b) => a.want - b.want);
  const pivot = Math.max(
    0,
    sorted.findIndex((item) => item.id === activeId),
  );
  const anchored = activeId ? sorted[pivot].want : floor;

  // From the active note down, each note starts at its passage or below the
  // previous one.
  let next = activeId ? Math.max(floor, anchored) : floor;
  for (let i = activeId ? pivot : 0; i < sorted.length; i++) {
    const y = Math.max(sorted[i].want, next);
    out.set(sorted[i].id, y);
    next = y + sorted[i].height + gap;
  }
  if (!activeId) return out;

  // Above it, each note ends before the one below, as close to its passage
  // as it can be; then a top-down pass keeps everything under the floor.
  let limit = out.get(sorted[pivot].id)!;
  for (let i = pivot - 1; i >= 0; i--) {
    const y = Math.min(sorted[i].want, limit - gap - sorted[i].height);
    out.set(sorted[i].id, y);
    limit = y;
  }
  let min = floor;
  for (let i = 0; i < pivot; i++) {
    const y = Math.max(out.get(sorted[i].id)!, min);
    out.set(sorted[i].id, y);
    min = y + sorted[i].height + gap;
  }
  // If the floor pushed notes above the active one down, the active note and
  // those below it move down too, so nothing overlaps.
  if (pivot > 0 && min > out.get(sorted[pivot].id)!) {
    let at = min;
    for (let i = pivot; i < sorted.length; i++) {
      const y = Math.max(out.get(sorted[i].id)!, at);
      out.set(sorted[i].id, y);
      at = y + sorted[i].height + gap;
    }
  }
  return out;
}
