import { createUmapRun as createUmapRunOnServer } from "./umap.server";
import { action } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import { removeUmapArtifact } from "~/server/lib/umap/python-umap";
import { projectDocEmbeddingsIntoUmapRun } from "~/services/umap/umap.projection";
import { regenerateUmapRegions } from "~/services/umap/umap.regions";

const updateSchema = z.object({
  id: z.string().min(1),
  dims: z.union([z.literal(2), z.literal(3)]).optional(),
  params: z.record(z.any()).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

const projectSchema = z.object({
  umapRunId: z.string().min(1),
  embeddingRunId: z.string().min(1).optional(),
  docIds: z.array(z.string().min(1)).optional(),
  mode: z.enum(["missing", "all"]).default("missing"),
});

const regenerateRegionsSchema = z.object({
  id: z.string().min(1),
});

export const createUmapRun = action(
  async (payload: Parameters<typeof createUmapRunOnServer>[0]) => {
    "use server";
    return createUmapRunOnServer(payload);
  },
  "umap-run-create",
);

export const projectUmapRun = action(
  async (payload: z.infer<typeof projectSchema>) => {
    "use server";
    const input = projectSchema.parse(payload);
    console.info(
      `[umap] project requested run=${input.umapRunId} mode=${input.mode} embeddingRun=${input.embeddingRunId ?? "default"} docIds=${input.docIds?.length ?? 0}`,
    );

    const result = await projectDocEmbeddingsIntoUmapRun({
      umapRunId: input.umapRunId,
      embeddingRunId: input.embeddingRunId,
      docIds: input.docIds,
      mode: input.mode,
    });

    console.info(
      `[umap] projected run=${result.runId} embeddingRun=${result.embeddingRunId} projected=${result.projected} requested=${result.requested}`,
    );
    return result;
  },
  "umap-run-project",
);

export const regenerateUmapRegionsAction = action(
  async (payload: z.infer<typeof regenerateRegionsSchema>) => {
    "use server";
    const input = regenerateRegionsSchema.parse(payload);
    console.info(`[umap] regenerate regions requested run=${input.id}`);
    const snapshot = await regenerateUmapRegions(input.id);
    console.info(
      `[umap] regenerate regions complete run=${input.id} groups=${snapshot?.regions.length ?? 0} islands=${snapshot?.islands.length ?? 0}`,
    );
    return {
      runId: input.id,
      groups: snapshot?.regions.length ?? 0,
      islands: snapshot?.islands.length ?? 0,
    };
  },
  "umap-run-regenerate-regions",
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
  "umap-run-update",
);

export const deleteUmapRun = action(
  async (payload: z.infer<typeof deleteSchema>) => {
    "use server";
    const input = deleteSchema.parse(payload);
    const run = await prisma.umapRun.findUnique({
      where: { id: input.id },
      select: { id: true, artifactPath: true },
    });
    if (!run) throw new Error("Not found");

    await prisma.$transaction([
      prisma.umapPoint.deleteMany({ where: { runId: input.id } }),
      prisma.umapRun.delete({ where: { id: input.id } }),
    ]);
    await removeUmapArtifact(run.artifactPath).catch(() => {});
    return { ok: true, id: run.id };
  },
  "umap-run-delete",
);
