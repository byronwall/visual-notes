import type { UmapRegionsSnapshot } from "~/features/umap/region-types";
import type { UmapPoint } from "~/types/notes";

type UmapNormalization = {
  centerX: number;
  centerY: number;
  scale: number;
};

export function createUmapNormalization(
  points: UmapPoint[] | undefined,
  spread: number
): UmapNormalization | null {
  if (!points || points.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const safeWidth = width === 0 ? 1 : width;
  const safeHeight = height === 0 ? 1 : height;
  const scale = Math.min((2 * spread) / safeWidth, (2 * spread) / safeHeight);

  try {
    console.log(
      `[layout/umap-normalize] bbox=(${minX.toFixed(2)},${minY.toFixed(
        2
      )})..(${maxX.toFixed(2)},${maxY.toFixed(2)}) scale=${scale.toFixed(
        3
      )} count=${points.length}`
    );
  } catch {}

  return { centerX, centerY, scale };
}

export function normalizeUmap(
  points: UmapPoint[] | undefined,
  spread: number
): Map<string, { x: number; y: number }> {
  const normalization = createUmapNormalization(points, spread);
  if (!points || !normalization) return new Map();

  const map = new Map<string, { x: number; y: number }>();
  for (const point of points) {
    map.set(point.docId, {
      x: (point.x - normalization.centerX) * normalization.scale,
      y: (point.y - normalization.centerY) * normalization.scale,
    });
  }
  return map;
}

export function normalizeUmapRegions(
  points: UmapPoint[] | undefined,
  regions: UmapRegionsSnapshot | null | undefined,
  spread: number
): UmapRegionsSnapshot | null {
  const normalization = createUmapNormalization(points, spread);
  if (!regions || !normalization) return null;

  return {
    ...regions,
    regions: regions.regions.map((region) => ({
      ...region,
      centroid: {
        x: (region.centroid.x - normalization.centerX) * normalization.scale,
        y: (region.centroid.y - normalization.centerY) * normalization.scale,
      },
      radius: region.radius * normalization.scale,
      bounds: {
        minX: (region.bounds.minX - normalization.centerX) * normalization.scale,
        minY: (region.bounds.minY - normalization.centerY) * normalization.scale,
        maxX: (region.bounds.maxX - normalization.centerX) * normalization.scale,
        maxY: (region.bounds.maxY - normalization.centerY) * normalization.scale,
      },
    })),
    islands: regions.islands.map((island) => ({
      ...island,
      centroid: {
        x: (island.centroid.x - normalization.centerX) * normalization.scale,
        y: (island.centroid.y - normalization.centerY) * normalization.scale,
      },
      radius: island.radius * normalization.scale,
      bounds: {
        minX: (island.bounds.minX - normalization.centerX) * normalization.scale,
        minY: (island.bounds.minY - normalization.centerY) * normalization.scale,
        maxX: (island.bounds.maxX - normalization.centerX) * normalization.scale,
        maxY: (island.bounds.maxY - normalization.centerY) * normalization.scale,
      },
    })),
  };
}
