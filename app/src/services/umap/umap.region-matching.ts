import type {
  UmapRegionItem,
  UmapRegionsSnapshot,
} from "~/features/umap/region-types";

export const REGION_MATCH_CONFIG = {
  /** Least Jaccard overlap (shared notes / all notes) for a new region to inherit an old id. */
  minJaccard: 0.2,
  /** Least overlap for an inherited region to also keep its old title and summary. */
  keepTitleJaccard: 0.5,
} as const;

export type RegionMatchResult = {
  /** The new regions with stable ids; kept titles are already copied in. */
  regions: UmapRegionItem[];
  /** Retired region id → the live region that took most of its notes. */
  redirects: Record<string, string>;
  /** Ids whose title was kept, so they need no new label. */
  keptTitleIds: Set<string>;
};

/**
 * Gives freshly clustered regions the ids of the previous snapshot's regions
 * they overlap most, so `?region=` links survive re-clustering and retrains.
 * Pairs are matched greedily by descending Jaccard overlap of `docIds`.
 * Unmatched new regions get ids never used before; unmatched old regions
 * redirect to the region holding most of their notes.
 */
export function matchRegionsToPrevious(
  previous: Pick<UmapRegionsSnapshot, "regions" | "redirects"> | null,
  next: UmapRegionItem[],
  config: {
    minJaccard: number;
    keepTitleJaccard: number;
  } = REGION_MATCH_CONFIG,
): RegionMatchResult {
  const oldRegions = previous?.regions ?? [];
  const oldRedirects = previous?.redirects ?? {};
  const oldSets = oldRegions.map((region) => new Set(region.docIds));
  const nextSets = next.map((region) => new Set(region.docIds));

  const pairs: Array<{ oldIndex: number; nextIndex: number; jaccard: number }> =
    [];
  for (let oldIndex = 0; oldIndex < oldRegions.length; oldIndex += 1) {
    for (let nextIndex = 0; nextIndex < next.length; nextIndex += 1) {
      const jaccard = jaccardOf(oldSets[oldIndex]!, nextSets[nextIndex]!);
      if (jaccard >= config.minJaccard) {
        pairs.push({ oldIndex, nextIndex, jaccard });
      }
    }
  }
  pairs.sort((a, b) => b.jaccard - a.jaccard);

  const oldTaken = new Set<number>();
  const nextMatch = new Map<number, { oldIndex: number; jaccard: number }>();
  for (const pair of pairs) {
    if (oldTaken.has(pair.oldIndex) || nextMatch.has(pair.nextIndex)) continue;
    oldTaken.add(pair.oldIndex);
    nextMatch.set(pair.nextIndex, pair);
  }

  let nextNumber = highestRegionNumber([
    ...oldRegions.map((region) => region.id),
    ...Object.keys(oldRedirects),
    ...Object.values(oldRedirects),
  ]);
  const keptTitleIds = new Set<string>();
  const regions = next.map((region, nextIndex) => {
    const match = nextMatch.get(nextIndex);
    if (!match) {
      nextNumber += 1;
      return { ...region, id: `region-${nextNumber}` };
    }
    const old = oldRegions[match.oldIndex]!;
    if (match.jaccard < config.keepTitleJaccard)
      return { ...region, id: old.id };
    keptTitleIds.add(old.id);
    return {
      ...region,
      id: old.id,
      title: old.title,
      summary: old.summary,
      confidence: old.confidence,
    };
  });

  const liveIds = new Set(regions.map((region) => region.id));
  const redirects: Record<string, string> = {};
  oldRegions.forEach((old, oldIndex) => {
    if (oldTaken.has(oldIndex)) return;
    let bestIndex = -1;
    let bestShared = 0;
    nextSets.forEach((set, nextIndex) => {
      const shared = countShared(oldSets[oldIndex]!, set);
      if (shared > bestShared) {
        bestShared = shared;
        bestIndex = nextIndex;
      }
    });
    if (bestIndex >= 0) redirects[old.id] = regions[bestIndex]!.id;
  });
  // Older redirects follow their target to wherever it lives now.
  for (const [from, to] of Object.entries(oldRedirects)) {
    if (liveIds.has(from) || redirects[from]) continue;
    const target = liveIds.has(to) ? to : redirects[to];
    if (target) redirects[from] = target;
  }

  return { regions, redirects, keptTitleIds };
}

function jaccardOf(a: Set<string>, b: Set<string>) {
  const shared = countShared(a, b);
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

function countShared(a: Set<string>, b: Set<string>) {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const id of small) if (large.has(id)) shared += 1;
  return shared;
}

function highestRegionNumber(ids: string[]) {
  let highest = 0;
  for (const id of ids) {
    const match = /^region-(\d+)$/.exec(id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest;
}
