import { serverEnv } from "~/env/server";
import { prisma } from "~/server/db";
import { embedWithOpenAI } from "~/services/embeddings/embeddings.utils";

const LOG_PREFIX = "[mcp-semantic]";
/** Below this cosine similarity a doc is treated as unrelated. */
export const MIN_SIMILARITY = 0.25;
const INDEX_BATCH = 250;

type RunInfo = { id: string; model: string };
type VectorIndex = {
  runId: string;
  signature: string;
  /** DocEmbedding row id of each vector, so a refresh reloads only new rows. */
  rowIds: string[];
  docIds: string[];
  vectors: Float32Array[];
  norms: number[];
};

/**
 * How long a search waits for meaning-based matches before it answers with
 * keyword matches alone. A cold index load keeps going in the background.
 */
export const SEMANTIC_BUDGET_MS = 3_000;

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
 * Doc vectors for the run, cached in memory and brought up to date when the
 * run's embedding count or newest row changes.
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
  const previous = cachedIndex?.runId === run.id ? cachedIndex : null;
  if (previous?.signature === signature) return previous;
  // A refresh deletes and recreates the rows it re-embeds, so keep the
  // vectors whose rows still exist and decode only the new rows. Decoding
  // every vector of a 6,000-note run takes 10+ seconds.
  const current = previous
    ? await prisma.docEmbedding.findMany({
        where: { runId: run.id },
        select: { id: true },
      })
    : [];
  const keep = new Set(current.map((row) => row.id));
  const index: VectorIndex = {
    runId: run.id,
    signature,
    rowIds: [],
    docIds: [],
    vectors: [],
    norms: [],
  };
  previous?.rowIds.forEach((rowId, i) => {
    if (!keep.has(rowId)) return;
    keep.delete(rowId);
    index.rowIds.push(rowId);
    index.docIds.push(previous.docIds[i]);
    index.vectors.push(previous.vectors[i]);
    index.norms.push(previous.norms[i]);
  });
  const add = (rows: { id: string; docId: string; vector: number[] }[]) => {
    for (const row of rows) {
      const vector = Float32Array.from(row.vector);
      index.rowIds.push(row.id);
      index.docIds.push(row.docId);
      index.vectors.push(vector);
      index.norms.push(norm(vector));
    }
  };
  const select = { id: true, docId: true, vector: true } as const;
  if (previous) {
    // `keep` now holds only rows the cache has never seen.
    const missing = [...keep];
    for (let i = 0; i < missing.length; i += INDEX_BATCH) {
      add(
        await prisma.docEmbedding.findMany({
          where: { id: { in: missing.slice(i, i + INDEX_BATCH) } },
          select,
        }),
      );
    }
  } else {
    let cursor: string | undefined;
    for (;;) {
      // Convert each page before fetching another; keep only compact vectors.
      const rows = await prisma.docEmbedding.findMany({
        where: { runId: run.id, ...(cursor ? { id: { gt: cursor } } : {}) },
        orderBy: { id: "asc" },
        take: INDEX_BATCH,
        select,
      });
      add(rows);
      if (rows.length < INDEX_BATCH) break;
      cursor = rows[rows.length - 1].id;
    }
  }
  cachedIndex = index;
  console.info(
    `${LOG_PREFIX} ${previous ? "updated" : "loaded"} ${index.docIds.length} doc vectors for ${run.id}`,
  );
  return cachedIndex;
}

/** Starts loading the index so the first search after a restart is quick. */
export async function warmSemanticIndex(): Promise<void> {
  if (!semanticAvailable()) return;
  try {
    const run = await latestRun();
    if (run) await loadIndex(run);
  } catch (error) {
    console.warn(`${LOG_PREFIX} warm-up failed`, error);
  }
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

export type SemanticResult = {
  /**
   * used: meaning-based matches are merged in; off: embeddings are not set
   * up; loading: they took longer than the budget (try again shortly);
   * failed: the provider call failed.
   */
  status: "used" | "off" | "loading" | "failed";
  hits: { id: string; score: number }[];
};

/** Meaning-based matches, within a time budget so keywords never wait long. */
export async function semanticSearch(
  query: string,
  limit: number,
  budgetMs = SEMANTIC_BUDGET_MS,
): Promise<SemanticResult> {
  if (!semanticAvailable()) return { status: "off", hits: [] };
  const work = (async (): Promise<SemanticResult> => {
    const run = await latestRun();
    if (!run) return { status: "off", hits: [] };
    const [[queryVector], index] = await Promise.all([
      embedWithOpenAI([query], run.model, "search"),
      loadIndex(run),
    ]);
    return {
      status: "used",
      hits: rankBySimilarity(queryVector, index, limit),
    };
  })().catch((error: unknown): SemanticResult => {
    console.warn(`${LOG_PREFIX} search failed; using keyword only`, error);
    return { status: "failed", hits: [] };
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<SemanticResult>((resolve) => {
    timer = setTimeout(() => {
      console.info(`${LOG_PREFIX} over ${budgetMs}ms; answering with keywords`);
      resolve({ status: "loading", hits: [] });
    }, budgetMs);
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Notes whose stored embedding sits closest to `docId`'s, from the cached
 * index. No provider call: it only reads vectors already in the database.
 */
export async function docNeighbors(
  docId: string,
  limit: number,
  minScore: number,
): Promise<{ id: string; score: number }[]> {
  const run = await latestRun();
  if (!run) return [];
  const index = await loadIndex(run);
  const at = index.docIds.indexOf(docId);
  if (at < 0) return [];
  return rankBySimilarity(Array.from(index.vectors[at]), index, limit + 1)
    .filter((hit) => hit.id !== docId && hit.score >= minScore)
    .slice(0, limit);
}
