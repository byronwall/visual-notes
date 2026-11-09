/**
 * Start of the occurrence of `quote` in `text` nearest to `hint`, or null
 * when the quote is not there. Annotations store the quote and where it
 * started, so a repeated phrase resolves to the one that was highlighted.
 */
export function locateQuote(
  text: string,
  quote: string,
  hint: number | null | undefined,
): number | null {
  if (!quote) return null;
  let best: number | null = null;
  let from = text.indexOf(quote);
  while (from !== -1) {
    if (best === null || Math.abs(from - (hint ?? 0)) < Math.abs(best - (hint ?? 0))) {
      best = from;
    }
    from = text.indexOf(quote, from + 1);
  }
  return best;
}
