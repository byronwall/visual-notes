import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const id = event.params?.id as string;
  if (!id) return json({ error: "Missing id" }, { status: 400 });
  const doc = await (prisma as any).doc.findUnique({
    where: { id },
  });
  if (!doc) return json({ error: "Not found" }, { status: 404 });
  // Attach embedding runs relevant to this doc with summarized results
  const embeddings = await (prisma as any).docEmbedding.findMany({
    where: { docId: id },
    select: { runId: true, vector: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const runIds = Array.from(
    new Set((embeddings as any[]).map((e: any) => e.runId))
  );
  let runs: any[] = [];
  if (runIds.length) {
    runs = await (prisma as any).embeddingRun.findMany({
      where: { id: { in: runIds } },
      select: {
        id: true,
        model: true,
        dims: true,
        params: true,
        createdAt: true,
      },
    });
  }
  const byRunId = new Map<string, any>(
    (runs as any[]).map((r: any) => [String(r.id), r])
  );
  const embeddingRuns = (embeddings as any[]).map((e: any) => {
    const run = byRunId.get(String(e.runId)) || { id: e.runId };
    const vector = Array.isArray(e.vector) ? e.vector : [];
    return {
      id: String(run.id),
      model: run.model,
      dims: run.dims,
      params: run.params,
      runCreatedAt: run.createdAt,
      embeddedAt: e.createdAt,
      vectorDims: vector.length,
      vectorPreview: vector.slice(0, 8),
    };
  });
  return json({ ...doc, embeddingRuns });
}
