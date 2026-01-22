const BATCH_SIZE = 128;

export function estimateTokensApprox(s: string): number {
  return Math.max(1, Math.round(s.length / 3));
}

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

export async function embedBatched(
  texts: string[],
  model: string
): Promise<number[][]> {
  const MAX_BATCH_TOKENS = 7500;
  const PER_ITEM_TOKEN_LIMIT = 7400;

  function truncateToTokenLimit(s: string, maxTokens: number): string {
    const maxChars = Math.max(32, maxTokens * 3);
    if (estimateTokensApprox(s) <= maxTokens) return s;
    return s.slice(0, maxChars).trim();
  }

  const result: number[][] = new Array(texts.length).fill(null as any);
  let cursor = 0;
  while (cursor < texts.length) {
    let tokenSum = 0;
    const batchTexts: string[] = [];
    const batchIdxs: number[] = [];

    while (cursor < texts.length && batchTexts.length < BATCH_SIZE) {
      const raw = String(texts[cursor] || "").trim();
      if (!raw) {
        result[cursor] = [];
        cursor++;
        continue;
      }
      const truncated = truncateToTokenLimit(raw, PER_ITEM_TOKEN_LIMIT);
      const tok = estimateTokensApprox(truncated);
      if (tok > MAX_BATCH_TOKENS && batchTexts.length === 0) {
        batchTexts.push(truncated);
        batchIdxs.push(cursor);
        cursor++;
        break;
      }
      if (tokenSum + tok > MAX_BATCH_TOKENS) break;
      batchTexts.push(truncated);
      batchIdxs.push(cursor);
      tokenSum += tok;
      cursor++;
    }

    if (batchTexts.length === 0) {
      cursor++;
      continue;
    }

    try {
      const vecs = await embedWithOpenAI(batchTexts, model);
      console.log(
        `[embeddings] batch size`,
        batchTexts.length,
        `approxTokens`,
        tokenSum
      );
      for (let k = 0; k < batchIdxs.length; k++) {
        result[batchIdxs[k]] = vecs[k] || [];
      }
    } catch (err) {
      console.log(`[embeddings] batch failed, falling back to singles`, err);
      for (let k = 0; k < batchIdxs.length; k++) {
        const idx = batchIdxs[k];
        const t = batchTexts[k];
        try {
          const v = await embedWithOpenAI([t], model);
          result[idx] = v[0] || [];
        } catch (e) {
          console.log(`[embeddings] item failed, skipping index`, idx, e);
          result[idx] = [];
        }
      }
    }
  }

  for (let i = 0; i < result.length; i++) {
    if (!Array.isArray(result[i])) result[i] = [];
  }
  return result;
}
