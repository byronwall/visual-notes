import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { z } from "zod";
import UMAP from "umap-js";

const createSchema = z.object({
  embeddingRunId: z.string(),
  dims: z.union([z.literal(2), z.literal(3)]).default(2),
  params: z
    .object({
      nNeighbors: z.number().int().positive().optional(),
      minDist: z.number().min(0).max(1).optional(),
      metric: z.enum(["cosine", "euclidean"]).optional(),
    })
    .optional(),
});

export async function POST(event: APIEvent) {
  try {
    const input = createSchema.parse(await event.request.json());

    // Load vectors for this embedding run
    const rows = await (prisma as any).docEmbedding.findMany({
      where: { runId: input.embeddingRunId },
      select: { docId: true, vector: true },
      orderBy: { createdAt: "asc" },
    });
    if (!rows.length)
      return json({ error: "No embeddings for run" }, { status: 400 });

    const matrix = rows.map((r: any) => r.vector as number[]);
    const umap = new UMAP({
      nComponents: input.dims,
      nNeighbors: input.params?.nNeighbors ?? 15,
      minDist: input.params?.minDist ?? 0.1,
      metric: input.params?.metric ?? "cosine",
    } as any);
    const embedding = umap.fit(matrix);
    // embedding is a number[][] with dims columns

    const run = await (prisma as any).umapRun.create({
      data: {
        embeddingRunId: input.embeddingRunId,
        dims: input.dims,
        params: input.params ?? {},
      },
      select: { id: true },
    });

    const points = rows.map((r: any, i: number) => {
      const coords = embedding[i] as number[];
      return {
        runId: run.id,
        docId: r.docId,
        x: coords[0] ?? 0,
        y: coords[1] ?? 0,
        z: input.dims === 3 ? coords[2] ?? 0 : null,
      };
    });
    await (prisma as any).umapPoint.createMany({
      data: points,
      skipDuplicates: true,
    });

    return json({ jobId: null, runId: run.id }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message || "Failed to create UMAP run";
    return json({ error: msg }, { status: 400 });
  }
}

export async function GET(_event: APIEvent) {
  const runs = await (prisma as any).umapRun.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      dims: true,
      params: true,
      embeddingRunId: true,
      createdAt: true,
    },
    take: 20,
  });
  return json({ runs });
}
