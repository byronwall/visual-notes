import { describe, expect, it } from "vitest";
import { buildRegionLabelLayouts } from "./region-label-layout";
import {
  buildStableRegionLabelOrder,
  getVisibleRegionLabelCount,
} from "./region-label-order";
import { SELECTED_REGION_INSIDE_LABEL_ZOOM } from "./region-label-geometry";
import { buildFixedSelectedRegionLabelLayout } from "./selected-region-label";
import { makeRegions, overlappingPairs, viewportAt } from "./test-fixtures";

const offset = { x: 120, y: 80 };

function layoutAt(
  zoomScale: number,
  regions = makeRegions(16),
  extra: Partial<Parameters<typeof buildRegionLabelLayouts>[0]> = {},
) {
  const order = buildStableRegionLabelOrder(regions);
  const count = getVisibleRegionLabelCount({
    regionCount: regions.length,
    zoomScale,
    regionsOnly: false,
  });
  const labelOrder = order.slice(0, count);
  return buildRegionLabelLayouts({
    regions,
    labeledIds: new Set(labelOrder),
    labelOrder,
    zoomScale,
    offset,
    labelFontSize: 16 / zoomScale,
    allowRegionOverlap: false,
    viewportBounds: viewportAt({ zoomScale, offset }),
    ...extra,
  });
}

describe("buildStableRegionLabelOrder", () => {
  it("returns every region once, starting with the largest", () => {
    const regions = makeRegions(16);
    const order = buildStableRegionLabelOrder(regions);
    expect(new Set(order).size).toBe(regions.length);
    const largest = regions
      .slice()
      .sort((a, b) => b.docCount - a.docCount || b.radius - a.radius)[0]!;
    expect(order[0]).toBe(largest.id);
  });

  it("does not depend on the input order", () => {
    const regions = makeRegions(16);
    const reversed = regions.slice().reverse();
    expect(buildStableRegionLabelOrder(reversed)).toEqual(
      buildStableRegionLabelOrder(regions),
    );
  });

  it("handles zero and one region", () => {
    expect(buildStableRegionLabelOrder([])).toEqual([]);
    const [only] = makeRegions(1);
    expect(buildStableRegionLabelOrder([only!])).toEqual([only!.id]);
  });
});

describe("getVisibleRegionLabelCount", () => {
  it("never decreases as zoom grows", () => {
    let previous = 0;
    for (let zoom = 0.1; zoom <= 2; zoom += 0.01) {
      const count = getVisibleRegionLabelCount({
        regionCount: 60,
        zoomScale: zoom,
        regionsOnly: false,
      });
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });

  it("clamps between the min and max for each mode", () => {
    const at = (zoomScale: number, regionsOnly: boolean) =>
      getVisibleRegionLabelCount({ regionCount: 60, zoomScale, regionsOnly });
    expect(at(0.1, false)).toBe(12);
    expect(at(3, false)).toBe(42);
    expect(at(0.1, true)).toBe(18);
    expect(at(3, true)).toBe(54);
    expect(
      getVisibleRegionLabelCount({
        regionCount: 4,
        zoomScale: 0.1,
        regionsOnly: false,
      }),
    ).toBe(4);
    expect(
      getVisibleRegionLabelCount({
        regionCount: 0,
        zoomScale: 1,
        regionsOnly: false,
      }),
    ).toBe(0);
  });
});

describe("buildRegionLabelLayouts", () => {
  it.each([0.45, 0.6, 0.8, 1])(
    "places labels without overlapping each other at zoom %s",
    (zoomScale) => {
      const layouts = layoutAt(zoomScale);
      expect(layouts.length).toBeGreaterThan(0);
      expect(overlappingPairs(layouts)).toEqual([]);
    },
  );

  it("keeps labels inside the viewport", () => {
    const zoomScale = 0.6;
    const bounds = viewportAt({ zoomScale, offset });
    const halfPixel = 0.5 / zoomScale;
    for (const layout of layoutAt(zoomScale)) {
      expect(layout.minX).toBeGreaterThanOrEqual(bounds.minX - halfPixel);
      expect(layout.minY).toBeGreaterThanOrEqual(bounds.minY - halfPixel);
      expect(layout.maxX).toBeLessThanOrEqual(bounds.maxX + halfPixel);
      expect(layout.maxY).toBeLessThanOrEqual(bounds.maxY + halfPixel);
    }
  });

  it("avoids occupied boxes", () => {
    const zoomScale = 0.8;
    const base = layoutAt(zoomScale);
    const blocker = base[0]!;
    const occupied = [
      {
        minX: blocker.minX,
        minY: blocker.minY,
        maxX: blocker.maxX,
        maxY: blocker.maxY,
      },
    ];
    const layouts = layoutAt(zoomScale, makeRegions(16), {
      occupiedBoxes: occupied,
    });
    for (const layout of layouts) {
      expect(overlappingPairs([layout, occupied[0]!])).toEqual([]);
    }
  });

  it("labels the same regions in the same order across a small zoom change", () => {
    for (const zoomScale of [0.45, 0.6, 0.8, 1]) {
      const before = layoutAt(zoomScale);
      const after = layoutAt(zoomScale * 1.01);
      expect(after.map((layout) => layout.regionId)).toEqual(
        before.map((layout) => layout.regionId),
      );
    }
  });

  // Known flutter: a label can jump between an inside spot and an outside
  // spot (with leader) on a 1% zoom change. On this fixture it happens 30
  // times over 162 steps from 0.3 to 1.5, with jumps up to ~88 px. The
  // stable-label rewrite should fix this; then drop `.fails`.
  it.fails("keeps each label's placement across a small zoom change", () => {
    const zoomScale = 0.6;
    const before = layoutAt(zoomScale);
    const after = layoutAt(zoomScale * 1.01);
    expect(
      after.map((layout) => [layout.textAnchor, layout.showLeader]),
    ).toEqual(before.map((layout) => [layout.textAnchor, layout.showLeader]));
  });

  it("snaps label edges to half screen pixels", () => {
    const zoomScale = 0.73;
    for (const layout of layoutAt(zoomScale)) {
      const screenX = layout.minX * zoomScale + offset.x;
      const screenY = layout.minY * zoomScale + offset.y;
      expect(screenX * 2).toBeCloseTo(Math.round(screenX * 2), 6);
      expect(screenY * 2).toBeCloseTo(Math.round(screenY * 2), 6);
    }
  });

  it("puts a selected region's label outside its circle with a leader", () => {
    const regions = makeRegions(16);
    const selected = regions[5]!;
    const zoomScale = 2;
    const [layout] = buildRegionLabelLayouts({
      regions,
      labeledIds: new Set([selected.id]),
      labelOrder: [selected.id],
      emphasizedIds: new Set([selected.id]),
      zoomScale,
      offset,
      labelFontSize: 16 / zoomScale,
    });
    expect(layout?.regionId).toBe(selected.id);
    expect(layout?.showLeader).toBe(true);
    expect(layout!.minX).toBeGreaterThan(selected.centroid.x);
    expect(layout!.maxY).toBeLessThan(selected.centroid.y);
  });
});

describe("buildFixedSelectedRegionLabelLayout", () => {
  it("pins the label above-right of the circle with a leader", () => {
    const region = makeRegions(4)[2]!;
    const zoomScale = SELECTED_REGION_INSIDE_LABEL_ZOOM / 2;
    const layout = buildFixedSelectedRegionLabelLayout({
      region,
      zoomScale,
      offset,
      labelFontSize: 16 / zoomScale,
    });
    expect(layout.regionId).toBe(region.id);
    expect(layout.showLeader).toBe(true);
    expect(layout.minX).toBeGreaterThan(region.centroid.x);
    expect(layout.maxY).toBeLessThan(region.centroid.y);
  });
});
