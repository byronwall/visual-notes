// Type-only: the runtime modules load lazily so writes stay cheap.
import type { prisma } from "~/server/db";
import type { processEmbeddingRun } from "~/services/embeddings/embeddings.server";

const LOG_PREFIX = "[embedding-refresh]";
const REFRESH_DEBOUNCE_MS = 10_000;
const REFRESH_BATCH = 25;
/** Upper bound on back-to-back batches in one refresh; the sweep resumes. */
const MAX_FOLLOW_UPS = 40;
const SWEEP_INTERVAL_MS = 15 * 60_000;

/** The sweep timer lives on `globalThis` so HMR and duplicate bundles share it. */
const SWEEP_TIMER_KEY = Symbol.for("visual-notes.embedding-sweep");
type SweepGlobal = typeof globalThis & {
  [SWEEP_TIMER_KEY]?: ReturnType<typeof setInterval>;
};

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshing = false;
let pendingAfterRun = false;
let pendingSweep = false;

/** Timers here must not keep a script or test process alive. */
function unref(timer: unknown) {
  (timer as { unref?: () => void }).unref?.();
}

/**
 * Embeds new and changed notes shortly after a write, which also projects
 * them into the trained UMAP maps so they land on the canvas. Only the sweep
 * retrains a map, once it has drifted (see `umap.retrain.ts`). Safe to call from inside a write: it only arms a timer, loads its
 * dependencies lazily, and swallows failures. `sweep` also projects notes
 * that were embedded but never placed, and bootstraps the first runs.
 */
export function scheduleEmbeddingRefresh(options?: { sweep?: boolean }): void {
  if (options?.sweep) pendingSweep = true;
  if (refreshing) {
    pendingAfterRun = true;
    return;
  }
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    const sweep = pendingSweep;
    pendingSweep = false;
    void refreshLatestRun({ sweep });
  }, REFRESH_DEBOUNCE_MS);
  unref(refreshTimer);
}

/**
 * Starts the background sweep once per server process: one pass soon after
 * boot, then one every 15 minutes. The sweep is the catch-all for writes that
 * bypass `contentColumns` (raw SQL, admin migrations) and for refreshes lost
 * to a restart.
 */
export function startEmbeddingSweep(): void {
  if (process.env.NODE_ENV === "test") return;
  const store = globalThis as SweepGlobal;
  const previous = store[SWEEP_TIMER_KEY];
  // A re-evaluated module (dev HMR) re-arms the timer with its own code but
  // skips the boot pass, which already ran.
  if (previous) clearInterval(previous);
  const timer = setInterval(
    () => scheduleEmbeddingRefresh({ sweep: true }),
    SWEEP_INTERVAL_MS,
  );
  unref(timer);
  store[SWEEP_TIMER_KEY] = timer;
  if (previous) return;
  console.info(`${LOG_PREFIX} sweep started`);
  scheduleEmbeddingRefresh({ sweep: true });
}

type Deps = {
  prisma: typeof prisma;
  processEmbeddingRun: typeof processEmbeddingRun;
};

/** Embed missing and changed notes into one run, in follow-up batches. */
async function drainRun(deps: Deps, runId: string) {
  for (const mode of ["missing", "changed"] as const) {
    for (let pass = 0; pass <= MAX_FOLLOW_UPS; pass += 1) {
      const result = await deps.processEmbeddingRun({
        id: runId,
        mode,
        limit: REFRESH_BATCH,
      });
      console.info(`${LOG_PREFIX} refreshed ${mode} run=${runId}`, result);
      if (!result?.addedDocs || !result.remaining) break;
    }
  }
}

/**
 * First-run setup: embed every note when there is no embedding run, then
 * train one map when there is none at all. Later maps come only from the
 * aligned retrain, which keeps saved `?region=` links valid.
 */
async function bootstrapRuns(deps: Deps): Promise<boolean> {
  const [embeddingRuns, umapRuns] = await Promise.all([
    deps.prisma.embeddingRun.count(),
    deps.prisma.umapRun.count(),
  ]);
  if (embeddingRuns > 0 && umapRuns > 0) return false;
  if (embeddingRuns === 0) {
    const { createEmbeddingRun } = await import(
      "~/services/embeddings/embeddings.server"
    );
    console.info(`${LOG_PREFIX} bootstrapping the first embedding run`);
    await createEmbeddingRun({});
  }
  if (umapRuns === 0) {
    const run = await deps.prisma.embeddingRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, _count: { select: { docEmbeddings: true } } },
    });
    if (!run?._count.docEmbeddings) return true;
    const { createUmapRun } = await import("~/services/umap/umap.server");
    console.info(`${LOG_PREFIX} bootstrapping the first map run=${run.id}`);
    await createUmapRun({ embeddingRunId: run.id, dims: 2 });
  }
  return true;
}

/** Places embedded notes that the canvas map has no point for yet. */
async function projectUnplaced(deps: Deps, umapRun: UmapTarget) {
  const [points, embeddings] = await Promise.all([
    deps.prisma.umapPoint.count({ where: { runId: umapRun.id } }),
    deps.prisma.docEmbedding.count({
      where: { runId: umapRun.embeddingRunId },
    }),
  ]);
  if (points >= embeddings) return;
  const { projectDocEmbeddingsIntoUmapRun } = await import(
    "~/services/umap/umap.projection"
  );
  const result = await projectDocEmbeddingsIntoUmapRun({
    umapRunId: umapRun.id,
    mode: "missing",
  });
  console.info(`${LOG_PREFIX} projected unplaced notes`, result);
}

type UmapTarget = { id: string; embeddingRunId: string };

export async function refreshLatestRun(options?: {
  sweep?: boolean;
}): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    const [{ serverEnv }, db, embeddings] = await Promise.all([
      import("~/env/server"),
      import("~/server/db"),
      import("~/services/embeddings/embeddings.server"),
    ]);
    if (!serverEnv.OPENAI_API_KEY?.trim()) return;
    const deps: Deps = {
      prisma: db.prisma,
      processEmbeddingRun: embeddings.processEmbeddingRun,
    };
    const { prisma } = deps;
    // Bootstrapping embeds and places everything, so it ends the pass.
    if (options?.sweep && (await bootstrapRuns(deps))) return;

    // Search reads the newest embedding run; the canvas shows the newest
    // map, which may be built on an older run. Keep both current.
    const [latest, map] = await Promise.all([
      prisma.embeddingRun.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
      prisma.umapRun.findFirst({
        where: { artifactPath: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { id: true, embeddingRunId: true },
      }),
    ]);
    const runIds = new Set<string>();
    if (latest) runIds.add(latest.id);
    if (map) runIds.add(map.embeddingRunId);
    for (const runId of runIds) await drainRun(deps, runId);
    // Bring search's in-memory vectors up to date now, off the search path.
    // The boot sweep lands here too, so the first search after a deploy is warm.
    void import("~/server/mcp/semantic")
      .then((semantic) => semantic.warmSemanticIndex())
      .catch((error: unknown) =>
        console.warn(`${LOG_PREFIX} search index warm-up failed`, error),
      );
    if (options?.sweep && map) {
      await projectUnplaced(deps, map);
      // Retraining takes minutes, so it runs on its own and never blocks
      // later refreshes; the old map stays live until the new one is ready.
      const { maybeRetrainUmapRun } = await import(
        "~/services/umap/umap.retrain"
      );
      void maybeRetrainUmapRun(map.id);
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} embedding refresh failed`, error);
  } finally {
    refreshing = false;
    if (pendingAfterRun) {
      pendingAfterRun = false;
      scheduleEmbeddingRefresh();
    }
  }
}
