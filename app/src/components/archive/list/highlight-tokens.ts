export type HighlightPart = { text: string; match: boolean };

/** Splits text into matched/unmatched parts for each whitespace-separated query token (case-insensitive). */
export function splitByTokens(text: string, query: string): HighlightPart[] {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
  if (!tokens.length || !text) return [{ text, match: false }];
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  return text
    .split(pattern)
    .filter(Boolean)
    .map((part) => ({ text: part, match: tokens.includes(part.toLowerCase()) }));
}
