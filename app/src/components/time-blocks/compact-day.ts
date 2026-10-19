import type { TimeBlockItem } from "~/services/time-blocks/time-blocks.service";

export type TimeUpdate = {
  id: string;
  startTimeIso: string;
  endTimeIso: string;
};

type Placed = { block: TimeBlockItem; start: Date; end: Date };

const toPlaced = (block: TimeBlockItem): Placed => ({
  block,
  start: new Date(block.startTime),
  end: new Date(block.endTime),
});

const byStart = (a: Placed, b: Placed) => a.start.getTime() - b.start.getTime();

/**
 * Packs a day's movable blocks back-to-back, flowing them around fixed-time
 * blocks. Returns only the blocks whose times change.
 */
export const compactDayBlocks = (
  blocksForDay: TimeBlockItem[],
): TimeUpdate[] => {
  const fixed = blocksForDay
    .filter((b) => b.isFixedTime)
    .map(toPlaced)
    .sort(byStart);
  const movable = blocksForDay
    .filter((b) => !b.isFixedTime)
    .map(toPlaced)
    .sort(byStart);

  const updates: TimeUpdate[] = [];
  const placed = new Set<string>();
  let cursor: Date | null = null;
  const later = (a: Date | null, b: Date) =>
    a === null ? b : new Date(Math.max(a.getTime(), b.getTime()));

  for (let i = 0; i <= fixed.length; i++) {
    const previousFixed = i > 0 ? fixed[i - 1] : null;
    const nextFixed = i < fixed.length ? fixed[i] : null;
    if (previousFixed) cursor = later(cursor, previousFixed.end);

    for (const item of movable) {
      if (placed.has(item.block.id)) continue;
      const durationMs = item.end.getTime() - item.start.getTime();
      const start: Date = cursor ?? item.start;
      const end = new Date(start.getTime() + durationMs);
      if (nextFixed && end.getTime() > nextFixed.start.getTime()) continue;
      if (
        start.getTime() !== item.start.getTime() ||
        end.getTime() !== item.end.getTime()
      ) {
        updates.push({
          id: item.block.id,
          startTimeIso: start.toISOString(),
          endTimeIso: end.toISOString(),
        });
      }
      cursor = end;
      placed.add(item.block.id);
    }

    if (nextFixed) cursor = later(cursor, nextFixed.start);
  }
  return updates;
};
