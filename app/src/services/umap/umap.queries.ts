import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import { buildDocPreviewText } from "~/services/docs.queries";
import { parseUmapRegionsSnapshot } from "~/services/umap/umap.regions";
import type { UmapRegionsSnapshot } from "~/features/umap/region-types";

export type UmapRunSummary = {
  id: string;
  dims: number;
  params: Record<string, unknown> | null;
  embeddingRunId: string;
  hasArtifact: boolean;
  artifactPath?: string | null;
  regions: UmapRegionsSnapshot | null;
  regionCount: number;
  createdAt: string;
};

export type UmapRunDetail = UmapRunSummary & { count: number };
export type UmapRegionDoc = {
  id: string;
  title: string;
  updatedAt: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  previewText: string;
};
export type UmapRegionDetail = {
  run: UmapRunDetail;
  region: NonNullable<UmapRegionsSnapshot["regions"][number]>;
  island: UmapRegionsSnapshot["islands"][number] | null;
  docs: UmapRegionDoc[];
};

export type UmapPoint = { docId: string; x: number; y: number; z?: number | null };

export type UmapRunsQuery = {
  embeddingRunId?: string;
  limit?: number;
};

export const fetchUmapRuns = query(async (input: UmapRunsQuery = {}): Promise<UmapRunSummary[]> => {
  "use server";
  const limit = Math.min(200, Math.max(1, Number(input.limit ?? 20)));
  const embeddingRunId = String(input.embeddingRunId || "").trim();
  const runs = await prisma.umapRun.findMany({
    where: embeddingRunId ? { embeddingRunId } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      dims: true,
      params: true,
      embeddingRunId: true,
      artifactPath: true,
      regionsJson: true,
      createdAt: true,
    },
    take: limit,
  });
  return runs.map((r) => ({
    id: r.id,
    dims: r.dims,
      params: r.params as Record<string, unknown> | null,
      embeddingRunId: r.embeddingRunId,
      hasArtifact: Boolean(r.artifactPath),
      regions: parseUmapRegionsSnapshot(r.regionsJson),
      regionCount: parseUmapRegionsSnapshot(r.regionsJson)?.regions.length ?? 0,
      createdAt: r.createdAt.toISOString(),
    }));
}, "umap-runs");

export const fetchUmapRun = query(
  async (id: string): Promise<UmapRunDetail | null> => {
    "use server";
    if (!id) return null;
    const run = await prisma.umapRun.findUnique({
      where: { id },
      select: {
        id: true,
        dims: true,
        params: true,
        embeddingRunId: true,
        artifactPath: true,
        regionsJson: true,
        createdAt: true,
      },
    });
    if (!run) return null;
    const count = await prisma.umapPoint.count({ where: { runId: run.id } });
    return {
      id: run.id,
      dims: run.dims,
      params: run.params as Record<string, unknown> | null,
      embeddingRunId: run.embeddingRunId,
      hasArtifact: Boolean(run.artifactPath),
      artifactPath: run.artifactPath,
      regions: parseUmapRegionsSnapshot(run.regionsJson),
      regionCount: parseUmapRegionsSnapshot(run.regionsJson)?.regions.length ?? 0,
      createdAt: run.createdAt.toISOString(),
      count,
    };
  },
  "umap-run"
);

export const fetchUmapPointsForRun = query(
  async (runId: string): Promise<{ runId: string; dims: number; points: UmapPoint[] }> => {
    "use server";
    if (!runId) throw new Error("Missing runId");
    const run = await prisma.umapRun.findUnique({
      where: { id: runId },
      select: { id: true, dims: true },
    });
    if (!run) throw new Error("Run not found");

    const pts = await prisma.umapPoint.findMany({
      where: { runId },
      select: { docId: true, x: true, y: true, z: true },
    });
    return {
      runId,
      dims: run.dims,
      points: pts.map((p) => ({
        docId: p.docId,
        x: p.x,
        y: p.y,
        z: p.z,
      })),
    };
  },
  "umap-points"
);

export const fetchUmapRegionDetail = query(
  async (
    input: { runId: string; regionId: string }
  ): Promise<UmapRegionDetail | null> => {
    "use server";
    const runId = String(input.runId || "").trim();
    const regionId = String(input.regionId || "").trim();
    if (!runId || !regionId) return null;

    const run = await fetchUmapRun(runId);
    if (!run) return null;
    const regions = run.regions;
    if (!regions) return null;

    const region = regions.regions.find((item) => item.id === regionId) ?? null;
    if (!region) return null;
    const island = regions.islands.find((item) => item.id === region.islandId) ?? null;

    const rows = await prisma.doc.findMany({
      where: { id: { in: region.docIds } },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        path: true,
        meta: true,
        markdown: true,
        html: true,
      },
    });

    const byId = new Map(rows.map((row) => [row.id, row]));
    const docs = region.docIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .map((row) => ({
        id: row.id,
        title: row.title,
        updatedAt: row.updatedAt.toISOString(),
        path: row.path,
        meta: row.meta as Record<string, unknown> | null,
        previewText: buildDocPreviewText(row.markdown, row.html),
      }));

    return {
      run,
      region,
      island,
      docs,
    };
  },
  "umap-region-detail"
);
