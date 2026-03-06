import { prisma } from "~/server/db";
import { transformWithUmapModel } from "~/server/lib/umap/python-umap";

export type UmapProjectionMode = "missing" | "all";

export type VectorRow = {
  docId: string;
  vector: number[];
};

function normalizeVectorRows(rows: VectorRow[]): VectorRow[] {
  const seen = new Set<string>();
  const out: VectorRow[] = [];
  for (const row of rows) {
    const docId = String(row.docId);
    if (!docId || seen.has(docId)) continue;
    seen.add(docId);
    out.push({ docId, vector: row.vector });
  }
  return out;
}

async function filterExistingDocIds(
  runId: string,
  rows: VectorRow[]
): Promise<{ remaining: VectorRow[]; skippedExisting: number }> {
  if (!rows.length) return { remaining: rows, skippedExisting: 0 };
  const existing = await prisma.umapPoint.findMany({
    where: {
      runId,
      docId: { in: rows.map((r) => r.docId) },
    },
    select: { docId: true },
  });
  if (!existing.length) return { remaining: rows, skippedExisting: 0 };
  const existingIds = new Set(existing.map((row) => row.docId));
  const remaining = rows.filter((row) => !existingIds.has(row.docId));
  return { remaining, skippedExisting: rows.length - remaining.length };
}

export async function projectVectorsIntoUmapRun(params: {
  umapRunId: string;
  rows: VectorRow[];
  mode?: UmapProjectionMode;
}): Promise<{
  runId: string;
  projected: number;
  skippedExisting: number;
  requested: number;
}> {
  const mode = params.mode ?? "missing";
  const run = await prisma.umapRun.findUnique({
    where: { id: params.umapRunId },
    select: { id: true, dims: true, artifactPath: true },
  });
  if (!run) throw new Error("UMAP run not found");
  if (!run.artifactPath) {
    throw new Error(
      "UMAP run has no persisted model artifact. Re-train this run first."
    );
  }

  const requestedRows = normalizeVectorRows(params.rows);
  if (!requestedRows.length) {
    return { runId: run.id, projected: 0, skippedExisting: 0, requested: 0 };
  }

  const filtered =
    mode === "missing"
      ? await filterExistingDocIds(run.id, requestedRows)
      : { remaining: requestedRows, skippedExisting: 0 };

  if (!filtered.remaining.length) {
    return {
      runId: run.id,
      projected: 0,
      skippedExisting: filtered.skippedExisting,
      requested: requestedRows.length,
    };
  }

  const transformed = await transformWithUmapModel({
    artifactPath: run.artifactPath,
    matrix: filtered.remaining.map((row) => row.vector),
    dims: run.dims === 3 ? 3 : 2,
  });

  if (transformed.points.length !== filtered.remaining.length) {
    throw new Error("UMAP transform returned unexpected number of points");
  }

  const projectedRows = filtered.remaining.map((row, index) => {
    const coords = transformed.points[index] ?? [];
    return {
      runId: run.id,
      docId: row.docId,
      x: coords[0] ?? 0,
      y: coords[1] ?? 0,
      z: run.dims === 3 ? (coords[2] ?? 0) : null,
    };
  });

  await prisma.$transaction([
    prisma.umapPoint.deleteMany({
      where: {
        runId: run.id,
        docId: { in: projectedRows.map((row) => row.docId) },
      },
    }),
    prisma.umapPoint.createMany({
      data: projectedRows,
      skipDuplicates: true,
    }),
  ]);

  return {
    runId: run.id,
    projected: projectedRows.length,
    skippedExisting: filtered.skippedExisting,
    requested: requestedRows.length,
  };
}

export async function projectDocEmbeddingsIntoUmapRun(params: {
  umapRunId: string;
  embeddingRunId?: string;
  docIds?: string[];
  mode?: UmapProjectionMode;
}): Promise<{
  runId: string;
  embeddingRunId: string;
  projected: number;
  skippedExisting: number;
  requested: number;
}> {
  const run = await prisma.umapRun.findUnique({
    where: { id: params.umapRunId },
    select: { id: true, embeddingRunId: true },
  });
  if (!run) throw new Error("UMAP run not found");

  const sourceEmbeddingRunId = params.embeddingRunId ?? run.embeddingRunId;
  const ids = params.docIds?.map((id) => String(id).trim()).filter(Boolean);

  const embeddings = await prisma.docEmbedding.findMany({
    where: {
      runId: sourceEmbeddingRunId,
      ...(ids && ids.length ? { docId: { in: ids } } : {}),
    },
    select: { docId: true, vector: true },
    orderBy: { createdAt: "asc" },
  });

  const projected = await projectVectorsIntoUmapRun({
    umapRunId: run.id,
    rows: embeddings.map((row) => ({
      docId: row.docId,
      vector: row.vector as number[],
    })),
    mode: params.mode,
  });

  return {
    runId: run.id,
    embeddingRunId: sourceEmbeddingRunId,
    projected: projected.projected,
    skippedExisting: projected.skippedExisting,
    requested: projected.requested,
  };
}
