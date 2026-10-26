import { z } from "zod";
import { prisma } from "~/server/db";
import { jobsDb } from "~/server/jobs-db";
import {
  removeUmapArtifact,
  trainUmapModel,
  type UmapPythonParams,
} from "~/server/lib/umap/python-umap";
import { regenerateUmapRegions } from "~/services/umap/umap.regions";
import { prepareUmapVectorRows } from "~/services/umap/umap.vectors";

const createSchema = z.object({
  embeddingRunId: z.string(),
  jobId: z.string().min(1).optional(),
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
      randomState: z.number().int().optional(),
    })
    .optional(),
});

export async function createUmapRun(payload: z.infer<typeof createSchema>) {
  const input = createSchema.parse(payload);
  console.info(
    `[umap] create run requested embeddingRun=${input.embeddingRunId} dims=${input.dims}`,
  );
  const job = await jobsDb().createJob("umap_train", null, input.jobId);
  let createdRunId: string | null = null;
  let artifactPath: string | null = null;

  try {
    await jobsDb().updateJobStage(job.id, "extract");
    const rows = await prisma.docEmbedding.findMany({
      where: { runId: input.embeddingRunId },
      select: { docId: true, vector: true },
      orderBy: { createdAt: "asc" },
    });
    if (!rows.length) throw new Error("No embeddings for run");
    console.info(
      `[umap] create run extracted embeddingRun=${input.embeddingRunId} rows=${rows.length} job=${job.id}`,
    );

    const run = await prisma.umapRun.create({
      data: {
        embeddingRunId: input.embeddingRunId,
        dims: input.dims,
        params: input.params ?? {},
        artifactPath: null,
      },
      select: { id: true },
    });
    createdRunId = run.id;

    await jobsDb().updateJobStage(job.id, "analyze");
    const preparedRows = prepareUmapVectorRows(
      rows.map((row) => ({
        docId: row.docId,
        vector: row.vector as number[],
      })),
    );
    if (!preparedRows.rows.length) {
      throw new Error("No usable embedding vectors found for this run");
    }
    if (preparedRows.droppedInvalid > 0 || preparedRows.droppedMismatched > 0) {
      console.warn("[umap] dropping inconsistent training vectors", {
        runId: run.id,
        embeddingRunId: input.embeddingRunId,
        requested: rows.length,
        kept: preparedRows.rows.length,
        targetDims: preparedRows.targetDims,
        droppedInvalid: preparedRows.droppedInvalid,
        droppedMismatched: preparedRows.droppedMismatched,
        dimCounts: preparedRows.dimCounts,
      });
    }
    console.info(
      `[umap] create run prepared run=${run.id} usable=${preparedRows.rows.length} droppedInvalid=${preparedRows.droppedInvalid} droppedMismatched=${preparedRows.droppedMismatched}`,
    );

    const trainResult = await trainUmapModel({
      runId: run.id,
      matrix: preparedRows.rows.map((row) => row.vector),
      dims: input.dims,
      umapParams: (input.params ?? {}) as UmapPythonParams,
    });
    artifactPath = trainResult.artifactPath;

    if (trainResult.points.length !== preparedRows.rows.length) {
      throw new Error("UMAP training returned unexpected number of points");
    }

    const points = preparedRows.rows.map((row, index) => {
      const coords = trainResult.points[index] ?? [];
      return {
        runId: run.id,
        docId: row.docId,
        x: coords[0] ?? 0,
        y: coords[1] ?? 0,
        z: input.dims === 3 ? coords[2] ?? 0 : null,
      };
    });

    await jobsDb().updateJobStage(job.id, "finalize");
    await prisma.$transaction([
      prisma.umapRun.update({
        where: { id: run.id },
        data: { artifactPath, trainedDocCount: points.length },
      }),
      prisma.umapPoint.createMany({
        data: points,
        skipDuplicates: true,
      }),
    ]);

    console.info(`[umap] create run deriving regions run=${run.id}`);
    await regenerateUmapRegions(run.id).catch((error) => {
      console.warn(`[umap] failed to derive regions for run=${run.id}`, error);
    });

    console.info(
      `[umap] trained run=${run.id} count=${points.length} fitMs=${
        trainResult.fitMs ?? -1
      }`,
    );

    await jobsDb().completeJob(job.id, run.id);
    return { jobId: job.id, runId: run.id, count: points.length };
  } catch (error) {
    if (artifactPath) {
      await removeUmapArtifact(artifactPath).catch(() => {});
    }
    if (createdRunId) {
      await prisma.umapPoint
        .deleteMany({ where: { runId: createdRunId } })
        .catch(() => {});
      await prisma.umapRun
        .delete({ where: { id: createdRunId } })
        .catch(() => null);
    }
    const message = error instanceof Error ? error.message : String(error);
    await jobsDb()
      .failJob(job.id, message)
      .catch(() => {});
    throw error;
  }
}
