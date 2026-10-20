import { serverEnv } from "~/env/server";
import { prisma } from "~/server/db";
import { processEmbeddingRun } from "~/services/embeddings/embeddings.actions";
import { embedWithOpenAI } from "~/services/embeddings/embeddings.utils";

const LOG_PREFIX = "[mcp-semantic]";
/** Below this cosine similarity a doc is treated as unrelated. */
export const MIN_SIMILARITY = 0.25;
const REFRESH_DEBOUNCE_MS = 10_000;
const REFRESH_BATCH = 25;
const INDEX_BATCH = 250;

type RunInfo = { id: string; model: string };
type VectorIndex = {
  runId: string;
  signature: string;
  docIds: string[];
  vectors: Float32Array[];
  norms: number[];
};

let cachedIndex: VectorIndex | null = null;
let indexLoad: Promise<VectorIndex> | null = null;

function semanticAvailable(): boolean {
  return Boolean(serverEnv.OPENAI_API_KEY?.trim());
}

/** The newest embedding run defines the vector space used for search. */
async function latestRun(): Promise<RunInfo | null> {
  return prisma.embeddingRun.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, model: true },
  });
}

function norm(vector: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
  return Math.sqrt(sum);
}

/**
 * Doc vectors for the run, cached in memory and reloaded when the run's
 * embedding count or newest row changes.
 */
async function loadIndex(run: RunInfo): Promise<VectorIndex> {
  // Searches share the in-flight load instead of each decoding the whole run.
  if (indexLoad) {
    const index = await indexLoad;
    return index.runId === run.id ? index : loadIndex(run);
  }
  indexLoad = updateIndex(run);
  try {
    return await indexLoad;
  } finally {
    indexLoad = null;
  }
}

async function updateIndex(run: RunInfo): Promise<VectorIndex> {
  const stats = await prisma.docEmbedding.aggregate({
    where: { runId: run.id },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const signature = `${stats._count._all}:${stats._max.createdAt?.getTime() ?? 0}`;
  if (cachedIndex?.runId === run.id && cachedIndex.signature === signature) {
    return cachedIndex;
  }
  const index: VectorIndex = {
    runId: run.id,
    signature,
    docIds: [],
    vectors: [],
    norms: [],
  };
  let cursor: string | undefined;
  for (;;) {
    // Convert each page before fetching another; keep only compact vectors.
    const rows = await prisma.docEmbedding.findMany({
      where: { runId: run.id, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: "asc" },
      take: INDEX_BATCH,
      select: { id: true, docId: true, vector: true },
    });
    for (const row of rows) {
      const vector = Float32Array.from(row.vector);
      index.docIds.push(row.docId);
      index.vectors.push(vector);
      index.norms.push(norm(vector));
    }
    if (rows.length < INDEX_BATCH) break;
    cursor = rows[rows.length - 1].id;
  }
  cachedIndex = index;
  console.info(
    `${LOG_PREFIX} loaded ${index.docIds.length} doc vectors for ${run.id}`,
  );
  return cachedIndex;
}

export function rankBySimilarity(
  query: number[],
  index: Pick<VectorIndex, "docIds" | "vectors" | "norms">,
  limit: number,
): { id: string; score: number }[] {
  const queryNorm = norm(query);
  if (!queryNorm) return [];
  const scored: { id: string; score: number }[] = [];
  index.vectors.forEach((vector, i) => {
    if (vector.length !== query.length || !index.norms[i]) return;
    let dot = 0;
    for (let d = 0; d < vector.length; d += 1) dot += vector[d] * query[d];
    const score = dot / (queryNorm * index.norms[i]);
    if (score >= MIN_SIMILARITY) scored.push({ id: index.docIds[i], score });
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Meaning-based matches, or null when embeddings are not set up. */
export async function semanticSearch(
  query: string,
  limit: number,
): Promise<{ id: string; score: number }[] | null> {
  if (!semanticAvailable()) return null;
  try {
    const run = await latestRun();
    if (!run) return null;
    const [[queryVector], index] = await Promise.all([
      embedWithOpenAI([query], run.model),
      loadIndex(run),
    ]);
    return rankBySimilarity(queryVector, index, limit);
  } catch (error) {
    console.warn(`${LOG_PREFIX} search failed; using keyword only`, error);
    return null;
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Embeds new and changed notes into the latest run shortly after a connector
 * write, so they become findable by meaning without a manual run.
 */
export function scheduleEmbeddingRefresh(): void {
  if (!semanticAvailable() || refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshLatestRun();
  }, REFRESH_DEBOUNCE_MS);
}

export async function refreshLatestRun(): Promise<void> {
  try {
    const run = await latestRun();
    if (!run) return;
    for (const mode of ["missing", "changed"] as const) {
      const result = await processEmbeddingRun({
        id: run.id,
        mode,
        limit: REFRESH_BATCH,
      });
      console.info(`${LOG_PREFIX} refreshed ${mode}`, result);
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} embedding refresh failed`, error);
  }
}
