import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { z } from "zod";
import * as UmapModule from "umap-js";
import { projectWithPCA } from "~/server/lib/embedding/pca";

const createSchema = z.object({
  embeddingRunId: z.string(),
  dims: z.union([z.literal(2), z.literal(3)]).default(2),
  params: z
    .object({
      pcaVarsToKeep: z.number().int().min(0).max(2048).default(50).optional(),
      nNeighbors: z.number().int().min(2).max(200).optional(),
      minDist: z.number().min(0).max(1).optional(),
      metric: z.enum(["cosine", "euclidean"]).optional(),
      learningRate: z.number().positive().optional(),
      nEpochs: z.number().int().positive().optional(),
      localConnectivity: z.number().int().min(1).optional(),
      repulsionStrength: z.number().positive().optional(),
      negativeSampleRate: z.number().int().min(1).optional(),
      setOpMixRatio: z.number().min(0).max(1).optional(),
      spread: z.number().positive().optional(),
      init: z.enum(["random", "spectral"]).optional(),
    })
    .optional(),
});

export async function POST(event: APIEvent) {
  try {
    const input = createSchema.parse(await event.request.json());

    // Load vectors for this embedding run
    const rows = await prisma.docEmbedding.findMany({
      where: { runId: input.embeddingRunId },
      select: { docId: true, vector: true },
      orderBy: { createdAt: "asc" },
    });
    if (!rows.length)
      return json({ error: "No embeddings for run" }, { status: 400 });

    const matrix = rows.map((r: any) => r.vector as number[]);
    const pcaKeep = input.params?.pcaVarsToKeep ?? 50;

    // if PCA = 0, then no PCA is applied
    const projected = pcaKeep === 0 ? matrix : projectWithPCA(matrix, pcaKeep);
    const UMAPCtor = (UmapModule as any).UMAP || (UmapModule as any).default;
    if (typeof UMAPCtor !== "function") {
      throw new Error("UMAP constructor not found in umap-js module");
    }
    const umap = new UMAPCtor({
      nComponents: input.dims,
      nNeighbors: input.params?.nNeighbors ?? 15,
      minDist: input.params?.minDist ?? 0.1,
      metric: input.params?.metric ?? "cosine",
      learningRate: input.params?.learningRate,
      nEpochs: input.params?.nEpochs,
      localConnectivity: input.params?.localConnectivity,
      repulsionStrength: input.params?.repulsionStrength,
      negativeSampleRate: input.params?.negativeSampleRate,
      setOpMixRatio: input.params?.setOpMixRatio,
      spread: input.params?.spread,
      init: input.params?.init,
    } as any);
    const embedding = umap.fit(projected);
    // embedding is a number[][] with dims columns

    const run = await prisma.umapRun.create({
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
    await prisma.umapPoint.createMany({
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
  const runs = await prisma.umapRun.findMany({
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
