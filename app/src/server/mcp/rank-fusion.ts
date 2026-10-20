export type FusedHit = {
  id: string;
  match: "keyword" | "semantic" | "both";
};

const RRF_K = 60;

/**
 * Reciprocal rank fusion: each list contributes 1 / (k + rank), so a note
 * found by both keyword and meaning rises above either list alone.
 */
export function fuseRankings(
  keywordIds: string[],
  semanticIds: string[],
  limit: number,
): FusedHit[] {
  const scores = new Map<
    string,
    { score: number; keyword: boolean; semantic: boolean }
  >();
  const add = (ids: string[], kind: "keyword" | "semantic") => {
    ids.forEach((id, rank) => {
      const entry = scores.get(id) ?? {
        score: 0,
        keyword: false,
        semantic: false,
      };
      entry.score += 1 / (RRF_K + rank + 1);
      entry[kind] = true;
      scores.set(id, entry);
    });
  };
  add(keywordIds, "keyword");
  add(semanticIds, "semantic");
  return Array.from(scores.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([id, entry]) => ({
      id,
      match:
        entry.keyword && entry.semantic
          ? "both"
          : entry.keyword
            ? "keyword"
            : "semantic",
    }));
}
