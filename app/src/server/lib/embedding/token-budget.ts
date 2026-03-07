export const OPENAI_EMBEDDING_MAX_INPUT_TOKENS = 8192;

// Leave headroom because our local counter is approximate and OpenAI may
// count some inputs less favorably than plain text heuristics.
export const OPENAI_EMBEDDING_REQUEST_TOKEN_BUDGET = 7000;
export const OPENAI_EMBEDDING_ITEM_TOKEN_BUDGET = 6000;

export function estimateTokensApprox(text: string): number {
  return Math.max(1, Math.round(text.length / 3));
}

export function estimateTokensUpperBound(text: string): number {
  if (!text) return 0;
  // UTF-8 byte length is a conservative upper bound on token count.
  return Buffer.byteLength(text, "utf8");
}
