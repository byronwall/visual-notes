import { query } from "@solidjs/router";
import { prisma } from "~/server/db";

export type UmapRunSummary = {
  id: string;
  dims: number;
  params: Record<string, unknown> | null;
  embeddingRunId: string;
  hasArtifact: boolean;
  artifactPath?: string | null;
  createdAt: string;
};

export type UmapRunDetail = UmapRunSummary & { count: number };

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
