// Fractional ranks for manual row order. Ranks are base-62 strings compared
// lexicographically; a new rank can always be made between any two.

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;

const digit = (s: string, i: number, fallback: number) =>
  i < s.length ? DIGITS.indexOf(s[i]!) : fallback;

/** Returns a rank strictly between `before` and `after` (either may be null). */
export function rankBetween(
  before: string | null,
  after: string | null,
): string {
  const a = before ?? "";
  const b = after ?? "";
  if (a && b && a >= b) throw new Error(`rankBetween: ${a} >= ${b}`);
  let result = "";
  for (let i = 0; ; i++) {
    const lo = digit(a, i, 0);
    const hi = b ? digit(b, i, BASE) : BASE;
    if (lo === hi) {
      result += DIGITS[lo];
      continue;
    }
    const mid = Math.floor((lo + hi) / 2);
    if (mid > lo) return result + DIGITS[mid];
    // Adjacent digits: keep `lo` and look for room in the next position.
    result += DIGITS[lo];
    const rest = rankBetween(a.slice(i + 1) || null, null);
    return result + rest;
  }
}

/** Ranks for appending `count` rows after `last`. */
export function ranksAfter(last: string | null, count: number): string[] {
  const out: string[] = [];
  let prev = last;
  for (let i = 0; i < count; i++) {
    prev = rankBetween(prev, null);
    out.push(prev);
  }
  return out;
}

export const compareRank = (a: string | null, b: string | null) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
};
