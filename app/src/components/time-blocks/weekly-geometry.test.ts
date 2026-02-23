import { describe, expect, it } from "vitest";
import { getDayIndexInRange, getVisibleSegmentForDay, toGridY } from "./weekly-geometry";

describe("weekly-geometry", () => {
  it("maps hour positions to different Y coordinates", () => {
    const sixAm = new Date(2026, 1, 22, 6, 0, 0, 0);
    const nineAm = new Date(2026, 1, 22, 9, 0, 0, 0);
    const twoPm = new Date(2026, 1, 22, 14, 0, 0, 0);

    expect(toGridY(sixAm, 6, 22, 56)).toBe(0);
    expect(toGridY(nineAm, 6, 22, 56)).toBe(168);
    expect(toGridY(twoPm, 6, 22, 56)).toBe(448);
  });

  it("clips segment to visible day range", () => {
    const weekStart = new Date(2026, 1, 22, 0, 0, 0, 0);
    const start = new Date(2026, 1, 22, 2, 45, 0, 0);
    const end = new Date(2026, 1, 22, 7, 30, 0, 0);

    const segment = getVisibleSegmentForDay(start, end, 0, weekStart, 6, 22);
    expect(segment).not.toBeNull();
    expect(segment!.visibleStart.getHours()).toBe(6);
    expect(segment!.visibleStart.getMinutes()).toBe(0);
    expect(segment!.visibleEnd.getHours()).toBe(7);
    expect(segment!.visibleEnd.getMinutes()).toBe(30);
  });

  it("does not clamp out-of-range day index into visible columns", () => {
    const weekStart = new Date(2026, 1, 22, 0, 0, 0, 0);
    const beforeWeek = new Date(2026, 1, 21, 12, 0, 0, 0);
    const afterWeek = new Date(2026, 2, 1, 12, 0, 0, 0);
    const insideWeek = new Date(2026, 1, 24, 12, 0, 0, 0);

    expect(getDayIndexInRange(beforeWeek, weekStart, 7)).toBeNull();
    expect(getDayIndexInRange(afterWeek, weekStart, 7)).toBeNull();
    expect(getDayIndexInRange(insideWeek, weekStart, 7)).toBe(2);
  });
});
