import { describe, expect, it } from "vitest";
import { roleBar, yearTicks } from "./company-timeline-model";

const axis = { from: "2001-01-01", to: "2026-12-31", first: 2001, last: 2026 };

describe("company timeline model", () => {
  it("spaces year labels to the track width", () => {
    expect(yearTicks(axis, 1200)).toHaveLength(26);
    expect(yearTicks(axis, 600)).toEqual([2001, 2003, 2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023, 2025]);
    expect(yearTicks(axis, 250)).toEqual([2001, 2006, 2011, 2016, 2021, 2026]);
  });

  it("draws a current role solid only to the day it was seen", () => {
    const bar = roleBar(
      {
        status: "current",
        startOn: "2018-03",
        endOn: null,
        observedOn: "2024-06-01",
        recordedOn: "2024-06-01",
      } as never,
      "2026-11-12",
    );
    expect(bar).toEqual({ from: "2018-03-01", to: "2024-06-01", tail: "2026-11-12" });
  });
});
