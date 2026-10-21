import { hashString, mulberry32 } from "~/utils/hash";

export type PlacedPoint = { x: number; y: number; approximate?: true };

/** The fields of a canvas doc that hint at where an unplaced note belongs. */
export type PlacementDoc = {
  id: string;
  title: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  collection?: { id: string } | null;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MAX_ATTEMPTS = 400;
/** Meta values shared by more than this share of placed notes say little. */
const MAX_META_SHARE = 0.2;

/** Grid-bucketed occupancy so each candidate checks only nearby dots. */
function createOccupancy(minSep: number) {
  const cells = new Map<string, PlacedPoint[]>();
  const key = (cx: number, cy: number) => `${cx}:${cy}`;
  return {
    add(p: PlacedPoint) {
      const k = key(Math.floor(p.x / minSep), Math.floor(p.y / minSep));
      const bucket = cells.get(k);
      if (bucket) bucket.push(p);
      else cells.set(k, [p]);
    },
    isFree(x: number, y: number) {
      const cx = Math.floor(x / minSep);
      const cy = Math.floor(y / minSep);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const p of cells.get(key(cx + dx, cy + dy)) ?? []) {
            if (Math.hypot(p.x - x, p.y - y) < minSep) return false;
          }
        }
      }
      return true;
    },
  };
}

function metaKeys(meta: PlacementDoc["meta"]): string[] {
  if (!meta) return [];
  const keys: string[] = [];
  for (const [name, value] of Object.entries(meta)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (typeof v === "string" ? v.trim() : typeof v === "number") {
        keys.push(`meta:${name}=${String(v).trim().toLowerCase()}`);
      }
    }
  }
  return keys;
}

function pathKeys(path: PlacementDoc["path"]): string[] {
  const parts = path?.trim() ? path.trim().split(".") : [];
  const keys: string[] = [];
  for (let n = parts.length; n > 0; n--) {
    keys.push(`path:${parts.slice(0, n).join(".")}`);
  }
  return keys;
}

/** Neighbor groups for a doc, strongest signal first. */
function groupKeys(doc: PlacementDoc): string[] {
  const keys: string[] = [];
  if (doc.collection?.id) keys.push(`collection:${doc.collection.id}`);
  const paths = pathKeys(doc.path);
  // The exact folder beats shared meta; distant ancestors come after it.
  if (paths.length) keys.push(paths[0]!);
  keys.push(...metaKeys(doc.meta));
  keys.push(...paths.slice(1));
  return keys;
}

/** The placed member closest to the group's centroid, so the anchor is a real dot. */
function medoid(points: PlacedPoint[]): PlacedPoint {
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  let best = points[0]!;
  let bestDist = Infinity;
  for (const p of points) {
    const d = (p.x - cx) ** 2 + (p.y - cy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/**
 * Positions for notes the map has no point for yet (not embedded, empty, or a
 * failed projection). Each lands beside a plausible neighbor (same collection,
 * folder, or shared meta value); the rest form a loose cluster just past the
 * map's lower-left edge. Placement is deterministic per note id and never
 * overlaps an existing dot. Every result is marked `approximate`.
 */
export function placeApproximate(params: {
  docs: PlacementDoc[];
  known: Map<string, PlacedPoint>;
  minSep: number;
  spread: number;
}): Map<string, PlacedPoint> {
  const { docs, known, minSep, spread } = params;
  const placed = new Map<string, PlacedPoint>();
  const occupancy = createOccupancy(minSep);
  const groups = new Map<string, PlacedPoint[]>();
  const pending: PlacementDoc[] = [];

  let minX = Infinity;
  let maxY = -Infinity;
  for (const doc of docs) {
    const p = known.get(doc.id);
    if (!p) {
      pending.push(doc);
      continue;
    }
    occupancy.add(p);
    if (p.x < minX) minX = p.x;
    if (p.y > maxY) maxY = p.y;
    for (const key of groupKeys(doc)) {
      const members = groups.get(key);
      if (members) members.push(p);
      else groups.set(key, [p]);
    }
  }
  if (pending.length === 0) return placed;

  const maxMetaMembers = Math.max(2, Math.floor(known.size * MAX_META_SHARE));
  const anchors = new Map<string, PlacedPoint>();
  const anchorFor = (doc: PlacementDoc) => {
    for (const key of groupKeys(doc)) {
      const members = groups.get(key);
      if (!members?.length) continue;
      if (key.startsWith("meta:") && members.length > maxMetaMembers) continue;
      let anchor = anchors.get(key);
      if (!anchor) {
        anchor = medoid(members);
        anchors.set(key, anchor);
      }
      return anchor;
    }
    return null;
  };

  const hasMap = Number.isFinite(minX);
  // Stable order so a note keeps its spot when unrelated notes arrive.
  const ordered = [...pending]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((doc) => ({ doc, anchor: hasMap ? anchorFor(doc) : null }));
  // Orphans gather just past the lower-left edge, far enough out that the
  // whole cluster stays clear of the map.
  const orphanCount = ordered.filter((item) => !item.anchor).length;
  const clusterRadius = minSep * Math.sqrt(orphanCount + 1);
  const margin = hasMap
    ? { x: minX + clusterRadius, y: maxY + minSep * 2 + clusterRadius }
    : { x: 0, y: 0 };

  for (const { doc, anchor } of ordered) {
    const rnd = mulberry32(hashString(`approx\u0000${doc.id}`));
    const center = anchor ?? margin;
    // Spiral outward from the anchor with per-note jitter: a loose sunflower
    // that reads as "near these", never rows and columns.
    const start = rnd() * Math.PI * 2;
    let spot: PlacedPoint | null = null;
    for (let i = anchor ? 1 : 0; i < MAX_ATTEMPTS; i++) {
      const r = minSep * (anchor ? 0.6 : 0.9) * Math.sqrt(i + 0.5);
      const angle = start + i * GOLDEN_ANGLE + (rnd() - 0.5) * 0.6;
      const x = center.x + Math.cos(angle) * r * (0.85 + rnd() * 0.3);
      const y = center.y + Math.sin(angle) * r * (0.85 + rnd() * 0.3);
      if (occupancy.isFree(x, y)) {
        spot = { x, y, approximate: true };
        break;
      }
    }
    spot ??= {
      x: center.x + (rnd() - 0.5) * spread * 0.1,
      y: center.y + (rnd() - 0.5) * spread * 0.1,
      approximate: true,
    };
    occupancy.add(spot);
    placed.set(doc.id, spot);
  }
  return placed;
}
