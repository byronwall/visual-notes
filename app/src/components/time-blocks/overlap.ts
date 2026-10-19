import type { TimeBlockItem } from "~/services/time-blocks/time-blocks.service";

export type TimeBlockWithPosition = TimeBlockItem & {
  /** Zero-based lane the block starts in. */
  column: number;
  /** Lane count of the overlap cluster the block belongs to. */
  columns: number;
  /** Lanes the block can stretch across without hitting a neighbor. */
  span: number;
};

type Timed = { block: TimeBlockItem; start: number; end: number };

const toTimed = (block: TimeBlockItem): Timed => {
  const start = new Date(block.startTime).getTime();
  const end = new Date(block.endTime).getTime();
  return { block, start, end: Math.max(end, start + 1) };
};

const overlaps = (a: Timed, b: Timed) => a.start < b.end && b.start < a.end;

/**
 * Lays out one day's blocks the way calendar apps do: blocks that overlap in
 * time form a cluster, each block takes the first free lane in its cluster,
 * and a block stretches right across lanes no overlapping neighbor uses.
 * Non-overlapping blocks always get the full width, even when a long chain of
 * overlaps (A↔B↔C) forces three lanes elsewhere in the cluster.
 */
export const layoutDayBlocks = (
  blocks: TimeBlockItem[],
): TimeBlockWithPosition[] => {
  const sorted = blocks
    .map(toTimed)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: TimeBlockWithPosition[] = [];
  let cluster: Array<Timed & { column: number }> = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const columns = laneEnds.length;
    for (const item of cluster) {
      let span = 1;
      while (item.column + span < columns) {
        const nextColumn = item.column + span;
        const blocked = cluster.some(
          (other) => other.column === nextColumn && overlaps(other, item),
        );
        if (blocked) break;
        span++;
      }
      result.push({ ...item.block, column: item.column, columns, span });
    }
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let column = laneEnds.findIndex((end) => end <= item.start);
    if (column === -1) {
      column = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[column] = item.end;
    }
    cluster.push({ ...item, column });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return result;
};
