import { describe, expect, it } from "vitest";
import { getHeadingViewportTops, resolveActiveRange } from "./range";

describe("resolveActiveRange", () => {
  it("tracks heading positions after ancestor movement or root scrolling", () => {
    const headingOffsets = [120, 420, 820];
    const afterAncestorScroll = getHeadingViewportTops(-60, headingOffsets, 0);
    const afterRootScroll = getHeadingViewportTops(240, headingOffsets, 300);

    expect(afterAncestorScroll).toEqual([60, 360, 760]);
    expect(afterRootScroll).toEqual(afterAncestorScroll);
    expect(resolveActiveRange(afterAncestorScroll, 80, 700)).toEqual({
      startIdx: 0,
      endIdx: 1,
    });
  });

  it("keeps duplicate-position headings in document order", () => {
    expect(resolveActiveRange([100, 100, 500], 120, 450)).toEqual({
      startIdx: 1,
      endIdx: 1,
    });
  });

  it("treats a heading that a jump parked on the top edge as active", () => {
    expect(resolveActiveRange([-400, 80.125, 900], 80, 640)).toEqual({
      startIdx: 1,
      endIdx: 1,
    });
  });
});
