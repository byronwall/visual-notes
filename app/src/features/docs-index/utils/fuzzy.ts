export function computeFuzzyScore(text: string, query: string): number {
  if (!query) return 1;
  if (!text) return 0;
  if (text.includes(query)) return 100 + query.length; // exact substring bonus
  let tIdx = 0;
  let qIdx = 0;
  let consecutive = 0;
  let score = 0;
  while (tIdx < text.length && qIdx < query.length) {
    if (text[tIdx] === query[qIdx]) {
      qIdx++;
      consecutive++;
      score += 2 + consecutive;
    } else {
      consecutive = 0;
    }
    tIdx++;
  }
  return qIdx === query.length ? score : 0;
}


