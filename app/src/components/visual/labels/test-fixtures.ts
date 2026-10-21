import type { UmapRegionItem } from "~/features/umap/region-types";
import type { DocItem } from "~/types/notes";
import type { Bounds, Point } from "./label-geometry";

const TITLES = [
  "Garden planning",
  "Home renovation notes",
  "Machine learning reading list",
  "Weekly retrospectives",
  "Travel ideas",
  "Recipes to try",
  "SolidJS patterns",
  "Database migrations",
  "Family history research",
  "Budget and finances",
  "Book notes",
  "Music practice log",
  "Running and fitness",
  "Team hiring",
  "Product strategy",
  "Kids school stuff",
];

/** Deterministic pseudo-random numbers in [0, 1). */
export function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

/** Regions on a jittered grid, roughly like a real UMAP overview. */
export function makeRegions(count: number, seed = 7): UmapRegionItem[] {
  const random = seededRandom(seed);
  const columns = Math.ceil(Math.sqrt(count));
  return Array.from({ length: count }, (_, index) => {
    const centroid = {
      x: (index % columns) * 260 + random() * 60,
      y: Math.floor(index / columns) * 220 + random() * 60,
    };
    const radius = 30 + random() * 50;
    return {
      id: `region-${index}`,
      title: TITLES[index % TITLES.length]!,
      summary: "",
      docCount: 5 + Math.floor(random() * 40),
      docIds: [],
      centroid,
      radius,
      bounds: {
        minX: centroid.x - radius,
        minY: centroid.y - radius,
        maxX: centroid.x + radius,
        maxY: centroid.y + radius,
      },
      islandId: "island-0",
      sampleDocs: [],
    };
  });
}

export function makeDocs(count: number, seed = 11) {
  const random = seededRandom(seed);
  const docs: DocItem[] = [];
  const positions = new Map<string, Point>();
  for (let index = 0; index < count; index += 1) {
    const id = `doc-${index}`;
    docs.push({
      id,
      title: `${TITLES[index % TITLES.length]} ${index}`,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    positions.set(id, { x: random() * 600, y: random() * 400 });
  }
  return { docs, positions };
}

/** World-space viewport for a screen of `width` × `height` at `zoomScale`. */
export function viewportAt(args: {
  zoomScale: number;
  offset: Point;
  width?: number;
  height?: number;
}): Bounds {
  const width = args.width ?? 1440;
  const height = args.height ?? 900;
  return {
    minX: -args.offset.x / args.zoomScale,
    minY: -args.offset.y / args.zoomScale,
    maxX: (width - args.offset.x) / args.zoomScale,
    maxY: (height - args.offset.y) / args.zoomScale,
  };
}

export function boxesOverlap(a: Bounds, b: Bounds) {
  return (
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 1e-6 &&
    Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > 1e-6
  );
}

export function overlappingPairs(boxes: Bounds[]) {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (boxesOverlap(boxes[i]!, boxes[j]!)) pairs.push([i, j]);
    }
  }
  return pairs;
}
