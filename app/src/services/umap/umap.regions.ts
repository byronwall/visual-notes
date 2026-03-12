import { Prisma } from "@prisma/client";
import { callLLM } from "~/server/lib/ai";
import { prisma } from "~/server/db";
import type {
  UmapIslandItem,
  UmapRegionBounds,
  UmapRegionItem,
  UmapRegionsSnapshot,
  UmapRegionSample,
} from "~/features/umap/region-types";

const MAX_GROUPS = 50;
const REGION_SAMPLE_COUNT = 5;
const MIN_REGION_LABEL_SAMPLES = 2;
const LLM_MODEL = "gpt-4o-mini";
const MIN_CLUSTER_SIZE = 12;

type RegionPointRow = {
  docId: string;
  title: string;
  path: string | null;
  x: number;
  y: number;
};

type Point2D = { x: number; y: number };

type ClusterAssignment = {
  centroid: Point2D;
  rows: RegionPointRow[];
};

type LabelPayload = {
  id: string;
  title: string;
  summary: string;
  confidence?: number;
};

export async function regenerateUmapRegions(
  runId: string
): Promise<UmapRegionsSnapshot | null> {
  const startedAt = Date.now();
  console.info(`[umap.regions] start run=${runId}`);

  const rows = await prisma.umapPoint.findMany({
    where: { runId },
    select: {
      docId: true,
      x: true,
      y: true,
      doc: {
        select: {
          title: true,
          path: true,
        },
      },
    },
  });

  if (!rows.length) {
    console.info(`[umap.regions] empty run=${runId} clearing snapshot`);
    await prisma.umapRun.update({
      where: { id: runId },
      data: {
        regionsJson: Prisma.DbNull,
        regionsUpdatedAt: new Date(),
      },
    });
    return null;
  }

  const points: RegionPointRow[] = rows.map((row) => ({
    docId: row.docId,
    title: row.doc.title,
    path: row.doc.path,
    x: row.x,
    y: row.y,
  }));

  const clusterCount = chooseClusterCount(points.length);
  const mapDiagonal = computeBoundsDiagonal(computeBounds(points));
  const maxDocsPerRegion = chooseMaxDocsPerRegion(points.length);
  const maxRadius = chooseMaxRadius(mapDiagonal);
  console.info(
    `[umap.regions] clustering run=${runId} points=${points.length} targetGroups=${clusterCount} maxDocs=${maxDocsPerRegion} maxRadius=${maxRadius.toFixed(
      2
    )}`
  );
  const clusters = buildClusters(points, clusterCount, runId, {
    maxGroups: MAX_GROUPS,
    maxDocsPerRegion,
    maxRadius,
  });
  const unlabeledRegions = clusters
    .filter((cluster) => cluster.rows.length > 0)
    .map((cluster, index) => buildRegion(cluster, index));
  console.info(
    `[umap.regions] clustered run=${runId} groups=${unlabeledRegions.length}`
  );

  const regionLabels = await labelRegions(unlabeledRegions).catch((error) => {
    console.warn(`[umap.regions] region labeling failed run=${runId}`, error);
    return new Map<string, LabelPayload>();
  });
  console.info(
    `[umap.regions] region labels run=${runId} labeled=${regionLabels.size}/${unlabeledRegions.length}`
  );

  const labeledRegions = unlabeledRegions.map((region) => {
    const label = regionLabels.get(region.id);
    return label
      ? {
          ...region,
          title: label.title,
          summary: label.summary,
          confidence: label.confidence ?? 0,
        }
      : region;
  });

  const regions = labeledRegions
    .sort(
      (a, b) =>
        (b.confidence ?? 0) - (a.confidence ?? 0) || b.docCount - a.docCount
    )
    .slice(0, MAX_GROUPS);

  const unlabeledIslands = buildIslands(regions);
  console.info(
    `[umap.regions] islands built run=${runId} islands=${unlabeledIslands.length}`
  );
  const islandLabels = await labelIslands(unlabeledIslands, regions).catch(
    (error) => {
      console.warn(`[umap.regions] island labeling failed run=${runId}`, error);
      return new Map<string, LabelPayload>();
    }
  );
  console.info(
    `[umap.regions] island labels run=${runId} labeled=${islandLabels.size}/${unlabeledIslands.length}`
  );

  const islands = unlabeledIslands.map((island) => {
    const label = islandLabels.get(island.id);
    return label
      ? {
          ...island,
          title: label.title,
          summary: label.summary,
        }
      : island;
  });

  const islandByRegionId = new Map<string, string>();
  for (const island of islands) {
    for (const regionId of island.regionIds)
      islandByRegionId.set(regionId, island.id);
  }

  const snapshot: UmapRegionsSnapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    maxGroups: MAX_GROUPS,
    totalPoints: points.length,
    regions: regions.map((region) => ({
      ...region,
      islandId: islandByRegionId.get(region.id) ?? region.islandId,
    })),
    islands,
  };

  await prisma.umapRun.update({
    where: { id: runId },
    data: {
      regionsJson: snapshot,
      regionsUpdatedAt: new Date(snapshot.generatedAt),
    },
  });

  console.info(
    `[umap.regions] complete run=${runId} groups=${snapshot.regions.length} islands=${snapshot.islands.length} points=${snapshot.totalPoints} ms=${
      Date.now() - startedAt
    }`
  );

  return snapshot;
}

export function parseUmapRegionsSnapshot(
  value: unknown
): UmapRegionsSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<UmapRegionsSnapshot>;
  if (
    candidate.version !== 1 ||
    !Array.isArray(candidate.regions) ||
    !Array.isArray(candidate.islands)
  ) {
    return null;
  }
  if (
    typeof candidate.generatedAt !== "string" ||
    typeof candidate.maxGroups !== "number"
  ) {
    return null;
  }
  return {
    ...candidate,
    regions: candidate.regions.map((region) => ({
      ...region,
      docIds: Array.isArray((region as { docIds?: unknown }).docIds)
        ? (region as { docIds: string[] }).docIds ?? []
        : Array.isArray(region.sampleDocs)
          ? region.sampleDocs.map((sample) => sample.docId)
          : [],
    })),
    islands: candidate.islands,
  } as UmapRegionsSnapshot;
}

function chooseClusterCount(total: number) {
  if (total <= 10) return 1;
  return Math.max(6, Math.min(MAX_GROUPS, Math.round(total / 12)));
}

function buildClusters(
  rows: RegionPointRow[],
  clusterCount: number,
  seedInput: string,
  opts: {
    maxGroups: number;
    maxDocsPerRegion: number;
    maxRadius: number;
  }
): ClusterAssignment[] {
  const initial = runKMeans(rows, clusterCount, seedInput);
  return splitLooseClusters(initial, `${seedInput}:split`, opts);
}

function runKMeans(
  rows: RegionPointRow[],
  clusterCount: number,
  seedInput: string
): ClusterAssignment[] {
  if (clusterCount <= 1 || rows.length <= 1) {
    return [
      {
        centroid: computeCentroid(rows),
        rows,
      },
    ];
  }

  const rng = createSeededRandom(seedInput);
  let centroids = initKMeansPlusPlus(rows, clusterCount, rng);
  let assignments = new Array<number>(rows.length).fill(0);

  for (let iteration = 0; iteration < 14; iteration += 1) {
    assignments = rows.map((row) => findClosestCentroid(row, centroids));
    const nextCentroids: Point2D[] = centroids.map((_centroid, index) => {
      const clusterRows = rows.filter(
        (_row, rowIndex) => assignments[rowIndex] === index
      );
      if (!clusterRows.length) {
        return rows[Math.floor(rng() * rows.length)] ?? centroids[index]!;
      }
      return computeCentroid(clusterRows);
    });
    const moved = nextCentroids.some((centroid, index) => {
      const current = centroids[index]!;
      return distanceSquared(centroid, current) > 1e-6;
    });
    centroids = nextCentroids;
    if (!moved) break;
  }

  return centroids
    .map((centroid, index) => ({
      centroid,
      rows: rows.filter((_row, rowIndex) => assignments[rowIndex] === index),
    }))
    .filter((cluster) => cluster.rows.length > 0);
}

function splitLooseClusters(
  clusters: ClusterAssignment[],
  seedInput: string,
  opts: {
    maxGroups: number;
    maxDocsPerRegion: number;
    maxRadius: number;
  }
) {
  const queue = clusters.slice().sort((a, b) => b.rows.length - a.rows.length);
  const finalized: ClusterAssignment[] = [];
  let splitIndex = 0;

  while (queue.length > 0) {
    const cluster = queue.shift()!;
    const radius = computeRadius(cluster.centroid, cluster.rows);
    const remainingCapacity = opts.maxGroups - finalized.length - queue.length;
    const shouldSplit =
      remainingCapacity > 0 &&
      cluster.rows.length >= MIN_CLUSTER_SIZE * 2 &&
      (cluster.rows.length > opts.maxDocsPerRegion || radius > opts.maxRadius);

    if (!shouldSplit) {
      finalized.push(cluster);
      continue;
    }

    const splitInto = Math.min(
      cluster.rows.length > opts.maxDocsPerRegion * 1.5 || radius > opts.maxRadius * 1.45
        ? 3
        : 2,
      remainingCapacity + 1
    );
    const pieces = runKMeans(cluster.rows, splitInto, `${seedInput}:${splitIndex}`);
    if (pieces.length <= 1) {
      finalized.push(cluster);
      continue;
    }

    console.info(
      `[umap.regions] split cluster rows=${cluster.rows.length} radius=${radius.toFixed(
        2
      )} into=${pieces.length}`
    );
    splitIndex += 1;
    queue.unshift(...pieces.sort((a, b) => b.rows.length - a.rows.length));
  }

  return finalized;
}

function buildRegion(
  cluster: ClusterAssignment,
  index: number
): UmapRegionItem {
  const bounds = computeBounds(cluster.rows);
  const radius = computeRadius(cluster.centroid, cluster.rows);
  const sampleDocs = buildSampleDocs(cluster.rows, cluster.centroid);
  return {
    id: `region-${index + 1}`,
    title: buildFallbackRegionTitle(cluster.rows),
    summary: buildFallbackRegionSummary(cluster.rows),
    docCount: cluster.rows.length,
    docIds: cluster.rows.map((row) => row.docId),
    centroid: cluster.centroid,
    radius,
    bounds,
    islandId: "",
    sampleDocs,
  };
}

function buildIslands(regions: UmapRegionItem[]): UmapIslandItem[] {
  if (!regions.length) return [];
  const visited = new Set<string>();
  const islands: UmapIslandItem[] = [];

  for (const region of regions) {
    if (visited.has(region.id)) continue;
    const queue = [region.id];
    const ids: string[] = [];
    visited.add(region.id);

    while (queue.length) {
      const currentId = queue.shift()!;
      ids.push(currentId);
      const current = regions.find((item) => item.id === currentId);
      if (!current) continue;
      for (const other of regions) {
        if (visited.has(other.id)) continue;
        if (regionsOverlap(current, other)) {
          visited.add(other.id);
          queue.push(other.id);
        }
      }
    }

    const members = regions.filter((item) => ids.includes(item.id));
    const bounds = combineBounds(members.map((item) => item.bounds));
    const centroid = computeWeightedCentroid(members);
    islands.push({
      id: `island-${islands.length + 1}`,
      title: buildFallbackIslandTitle(members),
      summary: buildFallbackIslandSummary(members),
      regionIds: members.map((item) => item.id),
      docCount: members.reduce((sum, item) => sum + item.docCount, 0),
      centroid,
      radius: computeIslandRadius(centroid, members),
      bounds,
    });
  }

  return islands;
}

async function labelRegions(regions: UmapRegionItem[]) {
  const targets = regions.filter(
    (region) => region.sampleDocs.length >= MIN_REGION_LABEL_SAMPLES
  );
  if (!targets.length) {
    console.info("[umap.regions] skip region labels reason=no-sample-targets");
    return new Map<string, LabelPayload>();
  }
  if (!process.env.OPENAI_API_KEY) {
    console.info("[umap.regions] skip region labels reason=missing-openai-key");
    return new Map<string, LabelPayload>();
  }
  console.info(
    `[umap.regions] request region labels groups=${targets.length} model=${LLM_MODEL}`
  );

  const payload = targets.map((region) => ({
    id: region.id,
    docCount: region.docCount,
    samples: region.sampleDocs.map((sample) => ({
      title: sample.title,
      path: sample.path || "",
      excerpt: sample.excerpt,
    })),
  }));

  const response = await callLLM({
    model: LLM_MODEL,
    temperature: 1,
    user: [
      "You are naming clusters in a note map.",
      "Return JSON only as an array.",
      'Each item must be {"id": string, "title": string, "summary": string, "confidence": number}.',
      "Titles should be 2-6 words and concrete.",
      "Summaries should be one short paragraph describing the common content in the cluster.",
      "Confidence is an integer 0-100 indicating how tight, cohesive, and clearly related the items in the cluster appear.",
      "Do not mention coordinates, clustering, or samples.",
      JSON.stringify(payload),
    ].join("\n\n"),
  });

  return parseLabels(response.output);
}

async function labelIslands(
  islands: UmapIslandItem[],
  regions: UmapRegionItem[]
) {
  if (!islands.length) {
    console.info("[umap.regions] skip island labels reason=no-islands");
    return new Map<string, LabelPayload>();
  }
  if (!process.env.OPENAI_API_KEY) {
    console.info("[umap.regions] skip island labels reason=missing-openai-key");
    return new Map<string, LabelPayload>();
  }
  console.info(
    `[umap.regions] request island labels islands=${islands.length} model=${LLM_MODEL}`
  );

  const payload = islands.map((island) => {
    const members = island.regionIds
      .map((regionId) => regions.find((region) => region.id === regionId))
      .filter((region): region is UmapRegionItem => Boolean(region));
    return {
      id: island.id,
      docCount: island.docCount,
      groups: members.map((region) => ({
        title: region.title,
        summary: region.summary,
        docCount: region.docCount,
      })),
    };
  });

  const response = await callLLM({
    model: LLM_MODEL,
    temperature: 1,
    user: [
      "You are naming higher-level islands in a note map.",
      "Return JSON only as an array.",
      'Each item must be {"id": string, "title": string, "summary": string}.',
      "Titles should read like topic areas, not geographic names.",
      "Summaries should describe the broader theme connecting the listed groups.",
      JSON.stringify(payload),
    ].join("\n\n"),
  });

  return parseLabels(response.output);
}

function parseLabels(output: string | undefined) {
  const map = new Map<string, LabelPayload>();
  if (!output) return map;
  const match = output.match(/\[[\s\S]*\]/);
  if (!match) return map;
  try {
    const parsed = JSON.parse(match[0]) as Array<Partial<LabelPayload>>;
    for (const item of parsed) {
      const id = String(item.id || "").trim();
      const title = String(item.title || "").trim();
      const summary = String(item.summary || "").trim();
      const confidence =
        typeof item.confidence === "number" ? item.confidence : 0;
      if (!id || !title || !summary) continue;
      map.set(id, { id, title, summary, confidence });
    }
  } catch (error) {
    console.warn("[umap.regions] failed to parse labels", error);
  }
  return map;
}

function buildSampleDocs(
  rows: RegionPointRow[],
  centroid: Point2D
): UmapRegionSample[] {
  // Use a random shuffle instead of sorting purely by centroid distance to get a wider semantic representation.
  return rows
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, REGION_SAMPLE_COUNT)
    .map((row) => ({
      docId: row.docId,
      title: row.title,
      path: row.path,
      excerpt: buildExcerpt(row),
    }));
}

function buildExcerpt(row: Pick<RegionPointRow, "title" | "path">) {
  const path = String(row.path || "").trim();
  if (path) return `Path: ${path}`;
  return `Note: ${row.title}`;
}

function buildFallbackRegionTitle(rows: RegionPointRow[]) {
  const pathPrefix = mostCommon(
    rows.map(
      (row) =>
        String(row.path || "")
          .split(".")
          .filter(Boolean)[0] || ""
    )
  );
  if (pathPrefix) return pathPrefix.replace(/[-_]/g, " ");
  return rows
    .slice(0, 2)
    .map((row) => row.title)
    .join(" / ")
    .slice(0, 60);
}

function buildFallbackRegionSummary(rows: RegionPointRow[]) {
  const samples = rows.slice(0, 3).map((row) => row.title);
  return `Includes notes such as ${samples.join(", ")}.`;
}

function buildFallbackIslandTitle(regions: UmapRegionItem[]) {
  return regions
    .slice(0, 2)
    .map((region) => region.title)
    .join(" + ")
    .slice(0, 60);
}

function buildFallbackIslandSummary(regions: UmapRegionItem[]) {
  return `Combines ${regions.length} nearby groups with related themes.`;
}

function computeBounds(rows: RegionPointRow[]): UmapRegionBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    if (row.x < minX) minX = row.x;
    if (row.y < minY) minY = row.y;
    if (row.x > maxX) maxX = row.x;
    if (row.y > maxY) maxY = row.y;
  }

  return { minX, minY, maxX, maxY };
}

function computeBoundsDiagonal(bounds: UmapRegionBounds) {
  const width = Math.max(0, bounds.maxX - bounds.minX);
  const height = Math.max(0, bounds.maxY - bounds.minY);
  return Math.sqrt(width * width + height * height);
}

function chooseMaxDocsPerRegion(totalPoints: number) {
  return Math.max(24, Math.min(180, Math.ceil(totalPoints * 0.075)));
}

function chooseMaxRadius(mapDiagonal: number) {
  if (!Number.isFinite(mapDiagonal) || mapDiagonal <= 0) return 1.5;
  return Math.max(0.45, mapDiagonal * 0.12);
}

function combineBounds(boundsList: UmapRegionBounds[]) {
  return boundsList.reduce<UmapRegionBounds>(
    (combined, bounds) => ({
      minX: Math.min(combined.minX, bounds.minX),
      minY: Math.min(combined.minY, bounds.minY),
      maxX: Math.max(combined.maxX, bounds.maxX),
      maxY: Math.max(combined.maxY, bounds.maxY),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );
}

function computeCentroid(rows: Array<Point2D>) {
  if (!rows.length) return { x: 0, y: 0 };
  const total = rows.reduce(
    (sum, row) => ({ x: sum.x + row.x, y: sum.y + row.y }),
    { x: 0, y: 0 }
  );
  return { x: total.x / rows.length, y: total.y / rows.length };
}

function computeWeightedCentroid(regions: UmapRegionItem[]) {
  const total = regions.reduce(
    (sum, region) => ({
      x: sum.x + region.centroid.x * region.docCount,
      y: sum.y + region.centroid.y * region.docCount,
      weight: sum.weight + region.docCount,
    }),
    { x: 0, y: 0, weight: 0 }
  );
  if (total.weight === 0) return { x: 0, y: 0 };
  return { x: total.x / total.weight, y: total.y / total.weight };
}

function computeRadius(centroid: Point2D, rows: Array<Point2D>) {
  const maxDistance = rows.reduce((max, row) => {
    const distance = Math.sqrt(distanceSquared(row, centroid));
    return Math.max(max, distance);
  }, 0);
  return maxDistance + Math.max(0.08 * maxDistance, 0.2);
}

function computeIslandRadius(centroid: Point2D, regions: UmapRegionItem[]) {
  return regions.reduce((max, region) => {
    const distance =
      Math.sqrt(distanceSquared(region.centroid, centroid)) + region.radius;
    return Math.max(max, distance);
  }, 0);
}

function regionsOverlap(a: UmapRegionItem, b: UmapRegionItem) {
  const centerDistance = Math.sqrt(distanceSquared(a.centroid, b.centroid));
  if (centerDistance <= a.radius + b.radius * 1.1) return true;
  return !(
    a.bounds.maxX < b.bounds.minX ||
    a.bounds.minX > b.bounds.maxX ||
    a.bounds.maxY < b.bounds.minY ||
    a.bounds.minY > b.bounds.maxY
  );
}

function findClosestCentroid(point: Point2D, centroids: Point2D[]) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < centroids.length; index += 1) {
    const distance = distanceSquared(point, centroids[index]!);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function initKMeansPlusPlus(
  rows: RegionPointRow[],
  clusterCount: number,
  rng: () => number
) {
  const centroids: Point2D[] = [];
  centroids.push(rows[Math.floor(rng() * rows.length)] ?? rows[0]!);

  while (centroids.length < clusterCount) {
    const distances = rows.map((row) => {
      const nearest = centroids.reduce((best, centroid) => {
        const current = distanceSquared(row, centroid);
        return Math.min(best, current);
      }, Number.POSITIVE_INFINITY);
      return nearest;
    });
    const total = distances.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      centroids.push(rows[Math.floor(rng() * rows.length)] ?? rows[0]!);
      continue;
    }
    let threshold = rng() * total;
    let nextIndex = 0;
    for (let index = 0; index < distances.length; index += 1) {
      threshold -= distances[index]!;
      if (threshold <= 0) {
        nextIndex = index;
        break;
      }
    }
    centroids.push(rows[nextIndex] ?? rows[0]!);
  }

  return centroids.map((centroid) => ({ x: centroid.x, y: centroid.y }));
}

function distanceSquared(a: Point2D, b: Point2D) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function createSeededRandom(input: string) {
  let seed = 0;
  for (let index = 0; index < input.length; index += 1) {
    seed = (seed * 31 + input.charCodeAt(index)) >>> 0;
  }
  return function seeded() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
