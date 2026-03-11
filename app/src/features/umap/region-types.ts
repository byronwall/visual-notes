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
};
