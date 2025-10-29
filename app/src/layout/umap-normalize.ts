import type { UmapPoint } from "~/types/notes";

export function normalizeUmap(
  points: UmapPoint[] | undefined,
  spread: number
): Map<string, { x: number; y: number }> {
  if (!points || points.length === 0) return new Map();

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const safeWidth = width === 0 ? 1 : width;
  const safeHeight = height === 0 ? 1 : height;
  const scale = Math.min((2 * spread) / safeWidth, (2 * spread) / safeHeight);

  const map = new Map<string, { x: number; y: number }>();
  for (const p of points) {
    const nx = (p.x - cx) * scale;
    const ny = (p.y - cy) * scale;
    map.set(p.docId, { x: nx, y: ny });
  }
  try {
    console.log(
      `[layout/umap-normalize] bbox=(${minX.toFixed(2)},${minY.toFixed(
        2
      )})..(${maxX.toFixed(2)},${maxY.toFixed(2)}) scale=${scale.toFixed(
        3
      )} count=${points.length}`
    );
  } catch {}
  return map;
}
