import {
  estimateTokensApprox,
  estimateTokensUpperBound,
  OPENAI_EMBEDDING_ITEM_TOKEN_BUDGET,
  OPENAI_EMBEDDING_MAX_INPUT_TOKENS,
  OPENAI_EMBEDDING_REQUEST_TOKEN_BUDGET,
} from "~/server/lib/embedding/token-budget";

const BATCH_SIZE = 128;

type OpenAIEmbeddingError = {
  error?: {
    message?: string;
  };
};

type Segment = {
  parentIndex: number;
  text: string;
  weight: number;
  upperBoundTokens: number;
};

export { estimateTokensApprox };

export async function embedWithOpenAI(
  texts: string[],
  model: string
): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`OpenAI embeddings error ${res.status}: ${msg.slice(0, 400)}`);
  }
  const json = (await res.json()) as any;
  const data = Array.isArray(json.data) ? json.data : [];
  return data.map((d: any) => d.embedding as number[]);
}

function tryParseOpenAIError(err: unknown): OpenAIEmbeddingError | null {
  if (!(err instanceof Error)) return null;
  const match = err.message.match(/\{[\s\S]*\}$/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as OpenAIEmbeddingError;
  } catch {
    return null;
  }
}

function getContextLimitExceeded(err: unknown): {
  requestedTokens: number;
  maxTokens: number;
} | null {
  const parsed = tryParseOpenAIError(err);
  const message = parsed?.error?.message || (err instanceof Error ? err.message : "");
  const match = message.match(
    /maximum context length is\s+(\d+)\s+tokens.*?requested\s+(\d+)\s+tokens/i
  );
  if (!match) return null;
  return {
    maxTokens: Number(match[1]),
    requestedTokens: Number(match[2]),
  };
}

function weightedMeanPool(vectors: number[][], weights: number[]): number[] {
  if (!vectors.length) return [];
  const dim = vectors[0]?.length || 0;
  if (!dim) return [];
  const acc = new Array<number>(dim).fill(0);
  let totalWeight = 0;
  for (let i = 0; i < vectors.length; i++) {
    const vector = vectors[i] || [];
    const weight = Math.max(1, weights[i] || 1);
    totalWeight += weight;
    for (let j = 0; j < dim; j++) acc[j] += (vector[j] || 0) * weight;
  }
  for (let j = 0; j < dim; j++) acc[j] /= totalWeight;
  return acc;
}

function chooseSplitIndex(text: string): number {
  const midpoint = Math.floor(text.length / 2);
  const separators = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "];

  for (const sep of separators) {
    const left = text.lastIndexOf(sep, midpoint);
    if (left >= Math.floor(text.length * 0.25)) return left + sep.length;
    const right = text.indexOf(sep, midpoint);
    if (right > 0 && right <= Math.floor(text.length * 0.75)) {
      return right + sep.length;
    }
  }

  return midpoint;
}

function splitTextToBudget(text: string, maxUpperBoundTokens: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (estimateTokensUpperBound(trimmed) <= maxUpperBoundTokens) return [trimmed];

  const splitIndex = chooseSplitIndex(trimmed);
  const left = trimmed.slice(0, splitIndex).trim();
  const right = trimmed.slice(splitIndex).trim();

  if (!left || !right) {
    const hardSplit = Math.max(1, Math.floor(trimmed.length / 2));
    const first = trimmed.slice(0, hardSplit).trim();
    const second = trimmed.slice(hardSplit).trim();
    if (!first || !second) return [trimmed.slice(0, maxUpperBoundTokens).trim()];
    return [
      ...splitTextToBudget(first, maxUpperBoundTokens),
      ...splitTextToBudget(second, maxUpperBoundTokens),
    ];
  }

  return [
    ...splitTextToBudget(left, maxUpperBoundTokens),
    ...splitTextToBudget(right, maxUpperBoundTokens),
  ];
}

function prepareSegments(texts: string[]): Segment[] {
  return texts.flatMap((text, parentIndex) => {
    const segments = splitTextToBudget(text, OPENAI_EMBEDDING_ITEM_TOKEN_BUDGET);
    return segments.map((segmentText) => ({
      parentIndex,
      text: segmentText,
      weight: Math.max(1, segmentText.length),
      upperBoundTokens: estimateTokensUpperBound(segmentText),
    }));
  });
}

async function embedSegmentRobust(text: string, model: string): Promise<number[]> {
  const segments = splitTextToBudget(text, OPENAI_EMBEDDING_ITEM_TOKEN_BUDGET);
  if (segments.length > 1) {
    const vectors = await Promise.all(
      segments.map((segment) => embedSegmentRobust(segment, model))
    );
    return weightedMeanPool(
      vectors,
      segments.map((segment) => Math.max(1, segment.length))
    );
  }

  try {
    const vector = await embedWithOpenAI([segments[0] || text], model);
    return vector[0] || [];
  } catch (err) {
    const contextExceeded = getContextLimitExceeded(err);
    if (!contextExceeded) throw err;

    const retryBudget = Math.max(
      1,
      Math.min(
        OPENAI_EMBEDDING_ITEM_TOKEN_BUDGET,
        contextExceeded.maxTokens - 512,
        Math.floor((segments[0] || text).length / 2)
      )
    );
    const smallerSegments = splitTextToBudget(segments[0] || text, retryBudget);
    if (smallerSegments.length <= 1) throw err;

    const vectors = await Promise.all(
      smallerSegments.map((segment) => embedSegmentRobust(segment, model))
    );
    return weightedMeanPool(
      vectors,
      smallerSegments.map((segment) => Math.max(1, segment.length))
    );
  }
}

export async function embedBatched(
  texts: string[],
  model: string
): Promise<number[][]> {
  const segments = prepareSegments(texts);
  const vectorsByParent = new Map<number, { vector: number[]; weight: number }[]>();
  const result: number[][] = new Array(texts.length).fill(null as any);

  let cursor = 0;
  while (cursor < segments.length) {
    let upperBoundSum = 0;
    const batch: Segment[] = [];

    while (cursor < segments.length && batch.length < BATCH_SIZE) {
      const segment = segments[cursor];
      if (!segment.text) {
        cursor++;
        continue;
      }
      if (
        batch.length > 0 &&
        upperBoundSum + segment.upperBoundTokens >
          OPENAI_EMBEDDING_REQUEST_TOKEN_BUDGET
      ) {
        break;
      }
      batch.push(segment);
      upperBoundSum += segment.upperBoundTokens;
      cursor++;
    }

    if (!batch.length && cursor < segments.length) {
      batch.push(segments[cursor]);
      upperBoundSum += segments[cursor].upperBoundTokens;
      cursor++;
    }

    if (!batch.length) continue;

    try {
      const vecs = await embedWithOpenAI(
        batch.map((segment) => segment.text),
        model
      );
      console.info("[embeddings] batch embedded", {
        size: batch.length,
        approxTokens: batch.reduce(
          (sum, segment) => sum + estimateTokensApprox(segment.text),
          0
        ),
        upperBoundTokens: upperBoundSum,
        maxInputTokens: OPENAI_EMBEDDING_MAX_INPUT_TOKENS,
      });
      for (let i = 0; i < batch.length; i++) {
        const segment = batch[i];
        const bucket = vectorsByParent.get(segment.parentIndex) || [];
        bucket.push({
          vector: vecs[i] || [],
          weight: segment.weight,
        });
        vectorsByParent.set(segment.parentIndex, bucket);
      }
    } catch (err) {
      console.warn("[embeddings] batch failed, falling back to singles", err);
      for (const segment of batch) {
        try {
          const vector = await embedSegmentRobust(segment.text, model);
          const bucket = vectorsByParent.get(segment.parentIndex) || [];
          bucket.push({
            vector,
            weight: segment.weight,
          });
          vectorsByParent.set(segment.parentIndex, bucket);
        } catch (singleErr) {
          console.warn("[embeddings] item failed, skipping index", {
            index: segment.parentIndex,
            err: singleErr,
          });
        }
      }
    }
  }

  for (let i = 0; i < texts.length; i++) {
    const entries = vectorsByParent.get(i) || [];
    result[i] = weightedMeanPool(
      entries.map((entry) => entry.vector),
      entries.map((entry) => entry.weight)
    );
  }

  return result.map((vector) => (Array.isArray(vector) ? vector : []));
}
