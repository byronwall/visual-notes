type Point = { x: number; y: number };

export type WorldBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** The visible canvas area in screen pixels, after rails and panels. */
export type CanvasViewport = {
  width: number;
  height: number;
};

export function boundsOfPoints(
  points: Iterable<Point>,
  padding = 0,
): WorldBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  if (!Number.isFinite(minX)) return null;
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}

export function unionBounds(items: WorldBounds[]): WorldBounds | null {
  if (items.length === 0) return null;
  return items.reduce((acc, item) => ({
    minX: Math.min(acc.minX, item.minX),
    minY: Math.min(acc.minY, item.minY),
    maxX: Math.max(acc.maxX, item.maxX),
    maxY: Math.max(acc.maxY, item.maxY),
  }));
}

/** Scale and offset that center `bounds` in the viewport. */
export function fitBoundsView(
  bounds: WorldBounds,
  viewport: CanvasViewport,
  options: {
    fill?: number;
    minSize?: number;
    minScale?: number;
    maxScale?: number;
  } = {},
) {
  const fill = options.fill ?? 0.92;
  const minSize = options.minSize ?? 240;
  const width = Math.max(minSize, bounds.maxX - bounds.minX);
  const height = Math.max(minSize, bounds.maxY - bounds.minY);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const scale = Math.max(
    options.minScale ?? 0.2,
    Math.min(
      options.maxScale ?? 2,
      fill * Math.min(viewport.width / width, viewport.height / height),
    ),
  );
  return {
    scale,
    offset: {
      x: viewport.width / 2 - centerX * scale,
      y: viewport.height / 2 - centerY * scale,
    },
  };
}

/** Offset that keeps `world` at the same scale but moves it to the viewport center. */
export function centerOnPointView(
  world: Point,
  scale: number,
  viewport: CanvasViewport,
) {
  return {
    scale,
    offset: {
      x: viewport.width / 2 - world.x * scale,
      y: viewport.height / 2 - world.y * scale,
    },
  };
}
