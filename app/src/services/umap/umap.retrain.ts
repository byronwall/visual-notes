import { randomUUID } from "node:crypto";
import { prisma } from "~/server/db";
import { jobsDb } from "~/server/jobs-db";
import {
  removeUmapArtifact,
  trainUmapModel,
  type UmapPythonParams,
} from "~/server/lib/umap/python-umap";
import { scheduleEmbeddingRefresh } from "~/server/notes/embedding-refresh";
import {
  applyAlignment,
  fitSimilarityTransform,
  type Point2,
} from "~/services/umap/umap.alignment";
import {
  buildUmapRegionsSnapshot,
  parseUmapRegionsSnapshot,
  type RegionPointRow,
} from "~/services/umap/umap.regions";
import { decideUmapRetrain } from "~/services/umap/umap.retrain-trigger";
import { prepareUmapVectorRows } from "~/services/umap/umap.vectors";

const LOG_PREFIX = "[umap-retrain]";
/**
 * Epochs for a warm-started fit. On synthetic clusters, 100 halved the mean
 * region drift of a spectral-init retrain; UMAP's 200-500 default drifts more.
 */
const WARM_START_EPOCHS = 100;

/** One retrain per process, shared across bundles and HMR. */
const RETRAIN_KEY = Symbol.for("visual-notes.umap-retrain");
type RetrainGlobal = typeof globalThis & { [RETRAIN_KEY]?: Promise<void> };

/**
 * Called by the embedding sweep for the canvas map. Retrains in the
 * background when the map has drifted; never throws.
 */
export function maybeRetrainUmapRun(runId: string): Promise<void> {
  const store = globalThis as RetrainGlobal;
  if (store[RETRAIN_KEY]) return store[RETRAIN_KEY];
  const task = (async () => {
    try {
      const run = await prisma.umapRun.findUnique({
        where: { id: runId },
        select: {
          id: true,
          dims: true,
          createdAt: true,
          trainedDocCount: true,
          _count: { select: { points: true } },
        },
      });
      if (!run || run.dims !== 2) return;
      const decision = decideUmapRetrain(
        {
          trainedDocCount: run.trainedDocCount,
          pointCount: run._count.points,
          createdAt: run.createdAt,
        },
        new Date(),
      );
      if (!decision.retrain) return;
      console.info(`${LOG_PREFIX} retraining run=${run.id}`, decision);
      await retrainUmapRun(run.id);
    } catch (error) {
      console.error(
        `${LOG_PREFIX} retrain failed run=${runId}; keeping it`,
        error,
      );
    } finally {
      delete store[RETRAIN_KEY];
    }
  })();
  store[RETRAIN_KEY] = task;
  return task;
}

/**
 * Trains a new map from the run's embeddings, aligns it to the old map,
 * carries region ids over, and only then saves it as the newest run, in one
 * transaction, so the canvas switches in a single step. Nothing is written
 * before that, so a failure leaves the old run as the canvas map.
 */
export async function retrainUmapRun(oldRunId: string): Promise<{
  runId: string;
  count: number;
  rms: number | null;
}> {
  const job = await jobsDb().createJob("umap_retrain", null);
  const runId = randomUUID();
  let artifactPath: string | null = null;
  try {
    await jobsDb().updateJobStage(job.id, "extract");
    const old = await prisma.umapRun.findUnique({
      where: { id: oldRunId },
      select: {
        id: true,
        dims: true,
        params: true,
        embeddingRunId: true,
        artifactPath: true,
      },
    });
    if (!old) throw new Error("Run not found");
    if (old.dims !== 2) throw new Error("Only 2D maps retrain automatically");
    const embeddings = await prisma.docEmbedding.findMany({
      where: { runId: old.embeddingRunId },
      select: { docId: true, vector: true },
      orderBy: { createdAt: "asc" },
    });
    const prepared = prepareUmapVectorRows(
      embeddings.map((row) => ({
        docId: row.docId,
        vector: row.vector as number[],
      })),
    );
    if (!prepared.rows.length) throw new Error("No usable embeddings");

    const oldPoints = await prisma.umapPoint.findMany({
      where: { runId: old.id },
      select: { docId: true, x: true, y: true },
    });
    const oldByDoc = new Map(oldPoints.map((point) => [point.docId, point]));

    await jobsDb().updateJobStage(job.id, "analyze");
    const params = (old.params ?? {}) as UmapPythonParams;
    const initPoints = warmStartLayout(
      prepared.rows.map((row) => row.docId),
      oldByDoc,
    );
    const trained = await trainUmapModel({
      runId,
      matrix: prepared.rows.map((row) => row.vector),
      dims: 2,
      // A short refinement keeps clusters near their old spots.
      umapParams: initPoints
        ? { ...params, nEpochs: params.nEpochs ?? WARM_START_EPOCHS }
        : params,
      initPoints,
    });
    artifactPath = trained.artifactPath;
    if (trained.points.length !== prepared.rows.length) {
      throw new Error("UMAP training returned unexpected number of points");
    }

    await jobsDb().updateJobStage(job.id, "generate");
    const rawPoints = prepared.rows.map((row, index) => ({
      docId: row.docId,
      x: trained.points[index]?.[0] ?? 0,
      y: trained.points[index]?.[1] ?? 0,
    }));
    const source: Point2[] = [];
    const target: Point2[] = [];
    for (const point of rawPoints) {
      const previous = oldByDoc.get(point.docId);
      if (!previous) continue;
      source.push(point);
      target.push(previous);
    }
    const alignment = fitSimilarityTransform(source, target);
    if (!alignment) {
      console.warn(
        `${LOG_PREFIX} too few shared notes to align run=${runId} shared=${source.length}`,
      );
    }
    const docs = await prisma.doc.findMany({
      where: { id: { in: rawPoints.map((point) => point.docId) } },
      select: { id: true, title: true, path: true },
    });
    const docById = new Map(docs.map((doc) => [doc.id, doc]));
    // Notes deleted during training have no Doc row left to point at.
    const regionPoints: RegionPointRow[] = rawPoints.flatMap((point) => {
      const doc = docById.get(point.docId);
      if (!doc) return [];
      const aligned = alignment ? applyAlignment(alignment, point) : point;
      return [
        { ...aligned, docId: point.docId, title: doc.title, path: doc.path },
      ];
    });

    // Read the old regions last so edits made during training carry over.
    const oldRegions = await prisma.umapRun.findUnique({
      where: { id: old.id },
      select: { regionsJson: true },
    });
    const regions = await buildUmapRegionsSnapshot(
      regionPoints,
      runId,
      parseUmapRegionsSnapshot(oldRegions?.regionsJson),
    );

    await jobsDb().updateJobStage(job.id, "finalize");
    const latest = await prisma.umapRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (latest?.id !== old.id) {
      throw new Error(`A newer map replaced run=${old.id} during training`);
    }
    await prisma.$transaction([
      prisma.umapRun.create({
        data: {
          id: runId,
          embeddingRunId: old.embeddingRunId,
          dims: 2,
          params: params,
          artifactPath,
          alignment: alignment ?? undefined,
          trainedDocCount: regionPoints.length,
          regionsJson: regions,
          regionsUpdatedAt: new Date(regions.generatedAt),
        },
      }),
      prisma.umapPoint.createMany({
        data: regionPoints.map((point) => ({
          runId,
          docId: point.docId,
          x: point.x,
          y: point.y,
          z: null,
        })),
        skipDuplicates: true,
      }),
    ]);
    console.info(
      `${LOG_PREFIX} switched canvas map old=${old.id} new=${runId} points=${regionPoints.length} shared=${source.length} rms=${alignment?.rms.toFixed(3) ?? "n/a"} scale=${alignment?.scale.toFixed(3) ?? "n/a"} reflected=${alignment?.reflected ?? "n/a"} regions=${regions.regions.length} redirects=${Object.keys(regions.redirects ?? {}).length}`,
    );
    await jobsDb().completeJob(job.id, runId);

    // The old map stays viewable but stops taking projections.
    await prisma.umapRun
      .update({ where: { id: old.id }, data: { artifactPath: null } })
      .then(() => removeUmapArtifact(old.artifactPath))
      .catch((error) => {
        console.warn(`${LOG_PREFIX} could not retire run=${old.id}`, error);
      });
    // Places notes embedded while the new model trained.
    scheduleEmbeddingRefresh({ sweep: true });
    return { runId, count: regionPoints.length, rms: alignment?.rms ?? null };
  } catch (error) {
    if (artifactPath) await removeUmapArtifact(artifactPath).catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    await jobsDb()
      .failJob(job.id, message)
      .catch(() => {});
    throw error;
  }
}

/**
 * Seeds the new model with each note's current position so UMAP refines the
 * old layout instead of inventing a new one; Procrustes then removes the
 * remaining offset and scale. Notes the old map lacks start at its center.
 * Falls back to UMAP's own init when the old map covers under half the notes.
 */
export function warmStartLayout(
  docIds: string[],
  oldByDoc: Map<string, Point2>,
): number[][] | undefined {
  const known = docIds.filter((docId) => oldByDoc.has(docId));
  if (known.length < Math.max(3, docIds.length / 2)) return undefined;
  let cx = 0;
  let cy = 0;
  for (const docId of known) {
    cx += oldByDoc.get(docId)!.x;
    cy += oldByDoc.get(docId)!.y;
  }
  cx /= known.length;
  cy /= known.length;
  return docIds.map((docId, index) => {
    const point = oldByDoc.get(docId);
    if (point) return [point.x, point.y];
    // Tiny deterministic spread so new notes don't stack on one point.
    return [cx + Math.cos(index) * 1e-3, cy + Math.sin(index) * 1e-3];
  });
}
