import { action } from "@solidjs/router";
import { z } from "zod";
import * as UmapModule from "umap-js";
import { prisma } from "~/server/db";
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

const updateSchema = z.object({
  id: z.string().min(1),
  dims: z.union([z.literal(2), z.literal(3)]).optional(),
  params: z.record(z.any()).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export const createUmapRun = action(
  async (payload: z.infer<typeof createSchema>) => {
    "use server";
    const input = createSchema.parse(payload);

    const rows = await prisma.docEmbedding.findMany({
      where: { runId: input.embeddingRunId },
      select: { docId: true, vector: true },
      orderBy: { createdAt: "asc" },
    });
    if (!rows.length) throw new Error("No embeddings for run");

    const matrix = rows.map((r: any) => r.vector as number[]);
    const pcaKeep = input.params?.pcaVarsToKeep ?? 50;
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

    return { jobId: null, runId: run.id };
  },
  "umap-run-create"
);

export const updateUmapRun = action(
  async (payload: z.infer<typeof updateSchema>) => {
    "use server";
    const input = updateSchema.parse(payload);
    const updated = await prisma.umapRun
      .update({
        where: { id: input.id },
        data: { dims: input.dims, params: input.params },
        select: {
          id: true,
          dims: true,
          params: true,
          embeddingRunId: true,
          createdAt: true,
        },
      })
      .catch(() => null);
    if (!updated) throw new Error("Not found");
    return {
      id: updated.id,
      dims: updated.dims,
      params: updated.params as Record<string, unknown> | null,
      embeddingRunId: updated.embeddingRunId,
      createdAt: updated.createdAt.toISOString(),
    };
  },
  "umap-run-update"
);

export const deleteUmapRun = action(
  async (payload: z.infer<typeof deleteSchema>) => {
    "use server";
    const input = deleteSchema.parse(payload);
    await prisma.umapPoint.deleteMany({ where: { runId: input.id } });
    const deleted = await prisma.umapRun
      .delete({ where: { id: input.id }, select: { id: true } })
      .catch(() => null);
    if (!deleted) throw new Error("Not found");
    return { ok: true, id: deleted.id };
  },
  "umap-run-delete"
);
