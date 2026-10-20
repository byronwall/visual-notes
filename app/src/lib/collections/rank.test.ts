import { describe, expect, it } from "vitest";
import { compareRank, rankBetween, ranksAfter } from "./rank";

describe("rankBetween", () => {
  it("makes a first rank and appends after it", () => {
    const first = rankBetween(null, null);
    const second = rankBetween(first, null);
    expect(second > first).toBe(true);
  });

  it("inserts between adjacent ranks", () => {
    const a = "a";
    const b = "b";
    const mid = rankBetween(a, b);
    expect(mid > a && mid < b).toBe(true);
  });

  it("inserts before the first rank", () => {
    const first = rankBetween(null, null);
    const before = rankBetween(null, first);
    expect(before < first).toBe(true);
  });

  it("keeps order across many repeated inserts at the same spot", () => {
    let lo = rankBetween(null, null);
    const hi = rankBetween(lo, null);
    for (let i = 0; i < 60; i++) {
      const mid = rankBetween(lo, hi);
      expect(mid > lo && mid < hi).toBe(true);
      lo = mid;
    }
  });

  it("rejects inverted bounds", () => {
    expect(() => rankBetween("b", "a")).toThrow();
  });
});

describe("ranksAfter and compareRank", () => {
  it("produces increasing ranks and sorts nulls last", () => {
    const ranks = ranksAfter(null, 5);
    expect([...ranks].sort()).toEqual(ranks);
    expect([null, ranks[1], ranks[0]].sort(compareRank)).toEqual([
      ranks[0],
      ranks[1],
      null,
    ]);
  });
});
