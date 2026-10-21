const LOG_PREFIX = "[embedding-refresh]";
const REFRESH_DEBOUNCE_MS = 10_000;
const REFRESH_BATCH = 25;
/** Upper bound on back-to-back batches after one burst of writes. */
const MAX_FOLLOW_UPS = 40;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshing = false;
let pendingAfterRun = false;

/**
 * Embeds new and changed notes into the latest embedding run shortly after a
 * write, which also projects them into that run's trained UMAP maps so they
 * land on the canvas. Never retrains a map. Safe to call from inside a write:
 * it only arms a timer, loads its dependencies lazily, and swallows failures.
 */
export function scheduleEmbeddingRefresh(): void {
  if (refreshing) {
    pendingAfterRun = true;
    return;
  }
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshLatestRun();
  }, REFRESH_DEBOUNCE_MS);
  // A pending refresh must not keep a script or test process alive.
  const timer = refreshTimer as unknown as { unref?: () => void };
  timer.unref?.();
}

export async function refreshLatestRun(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    const [{ serverEnv }, { prisma }, { processEmbeddingRun }] =
      await Promise.all([
        import("~/env/server"),
        import("~/server/db"),
        import("~/services/embeddings/embeddings.actions"),
      ]);
    if (!serverEnv.OPENAI_API_KEY?.trim()) return;
    const run = await prisma.embeddingRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!run) return;
    for (const mode of ["missing", "changed"] as const) {
      // Large imports drain in batches instead of waiting for the next write.
      for (let pass = 0; pass <= MAX_FOLLOW_UPS; pass += 1) {
        const result = await processEmbeddingRun({
          id: run.id,
          mode,
          limit: REFRESH_BATCH,
        });
        console.info(`${LOG_PREFIX} refreshed ${mode}`, result);
        if (!result?.addedDocs || !result.remaining) break;
      }
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
