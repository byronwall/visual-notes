import type { TimeBlockItem } from "~/services/time-blocks/time-blocks.service";

export type TimeBlockWithPosition = TimeBlockItem & {
  index: number;
  totalOverlaps: number;
};

const overlaps = (a: TimeBlockItem, b: TimeBlockItem) => {
  const aStart = new Date(a.startTime).getTime();
  const aEnd = new Date(a.endTime).getTime();
  const bStart = new Date(b.startTime).getTime();
  const bEnd = new Date(b.endTime).getTime();
  return aStart < bEnd && bStart < aEnd;
};

export const getOverlappingGroups = (
  blocks: TimeBlockItem[]
): TimeBlockWithPosition[][] => {
  const groups: TimeBlockWithPosition[][] = [];
  const sorted = [...blocks].sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  for (const block of sorted) {
    let added = false;
    for (const group of groups) {
      if (group.some((existing) => overlaps(existing, block))) {
        const nextCount = group.length + 1;
        group.forEach((existing, i) => {
          existing.index = i;
          existing.totalOverlaps = nextCount;
        });
        group.push({ ...block, index: group.length, totalOverlaps: nextCount });
        added = true;
        break;
      }
    }

    if (!added) {
      groups.push([{ ...block, index: 0, totalOverlaps: 1 }]);
    }
  }

  return groups;
};
