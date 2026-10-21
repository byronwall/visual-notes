export type UmapRegionSample = {
  docId: string;
  title: string;
  path?: string | null;
  excerpt: string;
};

export type UmapRegionBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type UmapRegionItem = {
  id: string;
  title: string;
  summary: string;
  docCount: number;
  docIds: string[];
  centroid: { x: number; y: number };
  radius: number;
  bounds: UmapRegionBounds;
  islandId: string;
  sampleDocs: UmapRegionSample[];
  confidence?: number;
};

export type UmapIslandItem = {
  id: string;
  title: string;
  summary: string;
  regionIds: string[];
  docCount: number;
  centroid: { x: number; y: number };
  radius: number;
  bounds: UmapRegionBounds;
};

export type UmapRegionsSnapshot = {
  version: 1;
  generatedAt: string;
  maxGroups: number;
  totalPoints: number;
  regions: UmapRegionItem[];
  islands: UmapIslandItem[];
  /** Retired region id → the live region that absorbed its notes. */
  redirects?: Record<string, string>;
};

/**
 * Resolves a saved region id (a `?region=` link) to a live region id,
 * following redirects left when regions merged or a map was retrained.
 */
export function resolveUmapRegionId(
  snapshot: Pick<UmapRegionsSnapshot, "regions" | "redirects"> | null | undefined,
  regionId: string | null | undefined
): string | null {
  if (!snapshot || !regionId) return null;
  const live = new Set(snapshot.regions.map((region) => region.id));
  let current = regionId;
  for (let hop = 0; hop < 8; hop += 1) {
    if (live.has(current)) return current;
    const next = snapshot.redirects?.[current];
    if (!next) return null;
    current = next;
  }
  return null;
}
