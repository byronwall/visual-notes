import { describe, expect, it } from "vitest";
import { buildRegionShapes } from "../regions/region-shape";
import {
  planRegionLabels,
  regionLabelTier,
  regionLabelWorldBox,
  tierMinZoom,
} from "./region-label-plan";
import {
  buildStableRegionLabelOrder,
  getVisibleRegionLabelCount,
} from "./region-label-order";
import { SettledViewGate, SETTLE_IDLE_MS } from "./settled-view";
import { makeRegions, overlappingPairs, seededRandom } from "./test-fixtures";

/** Regions plus notes scattered inside each region's circle. */
function makeScene(count = 16) {
  const regions = makeRegions(count);
  const random = seededRandom(5);
  const positions = new Map<string, { x: number; y: number }>();
  for (const region of regions) {
    for (let i = 0; i < 12; i++) {
      const id = `${region.id}-doc-${i}`;
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * region.radius;
      positions.set(id, {
        x: region.centroid.x + Math.cos(angle) * distance,
        y: region.centroid.y + Math.sin(angle) * distance,
      });
      region.docIds.push(id);
    }
  }
  const shapes = buildRegionShapes(regions, positions);
  const order = buildStableRegionLabelOrder(regions);
  return { regions, shapes, order };
}

function planAt(zoom: number, scene = makeScene(), selectedRegionId?: string) {
  return planRegionLabels({
    ...scene,
    zoom,
    regionsOnly: false,
    selectedRegionId,
  });
}

/** Shown labels' world boxes when drawn at `zoom`. */
function shownBoxes(plan: ReturnType<typeof planAt>, zoom: number) {
  return plan.labeledIds.map((id) =>
    regionLabelWorldBox(plan.layouts.get(id)!, zoom),
  );
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

describe("planRegionLabels", () => {
  it.each([0.3, 0.45, 0.6, 0.8, 1, 1.5])(
    "labels regions without overlap at zoom %s",
    (zoom) => {
      const plan = planAt(zoom);
      expect(plan.labeledIds.length).toBeGreaterThan(0);
      expect(overlappingPairs(shownBoxes(plan, zoom))).toEqual([]);
    },
  );

  it("stays overlap-free at every zoom inside the tier", () => {
    const scene = makeScene();
    const tier = regionLabelTier(0.6);
    const plan = planAt(0.6, scene);
    for (
      let zoom = tierMinZoom(tier);
      zoom < tierMinZoom(tier + 1);
      zoom *= 1.01
    ) {
      expect(overlappingPairs(shownBoxes(plan, zoom))).toEqual([]);
    }
  });

  // This was the known flutter (an `it.fails` before the rewrite): labels
  // jumped between inside and outside spots on a 1% zoom change. Placement
  // is now a world anchor chosen once per zoom tier.
  it("keeps each label's placement across a small zoom change", () => {
    const scene = makeScene();
    for (let zoom = 0.3; zoom <= 1.5; zoom *= 1.01) {
      const next = zoom * 1.01;
      if (regionLabelTier(next) !== regionLabelTier(zoom)) continue;
      const before = planAt(zoom, scene);
      const after = planAt(next, scene);
      expect(after.labeledIds).toEqual(before.labeledIds);
      for (const id of before.labeledIds) {
        expect(after.layouts.get(id)).toEqual(before.layouts.get(id));
      }
    }
  });

  it("is the same plan for any zoom in a tier", () => {
    const scene = makeScene();
    const tier = regionLabelTier(0.5);
    const low = planAt(tierMinZoom(tier), scene);
    const high = planAt(tierMinZoom(tier + 1) * 0.999, scene);
    expect(high).toEqual(low);
  });

  it("only gains labels as zoom grows across tiers", () => {
    const scene = makeScene(30);
    let previous = 0;
    for (
      let tier = regionLabelTier(0.3);
      tier <= regionLabelTier(1.5);
      tier++
    ) {
      const count = planAt(tierMinZoom(tier), scene).labeledIds.length;
      expect(count).toBeGreaterThanOrEqual(previous - 1);
      previous = count;
    }
  });

  it("labels only the selected region, above its shape", () => {
    const scene = makeScene();
    const selected = scene.regions[5]!;
    const plan = planAt(2, scene, selected.id);
    expect(plan.labeledIds).toEqual([selected.id]);
    const layout = plan.layouts.get(selected.id)!;
    expect(layout.placement).toBe("above");
    const shape = scene.shapes.get(selected.id)!;
    expect(regionLabelWorldBox(layout, 2).maxY).toBeLessThanOrEqual(
      shape.bounds.minY,
    );
  });

  it("gives every region a layout so hover can show its name", () => {
    const scene = makeScene();
    const plan = planAt(0.3, scene);
    expect(plan.layouts.size).toBe(scene.regions.length);
  });
});

describe("label count during a gesture", () => {
  /** A 1 s wheel zoom from overview to 1.2× at 60 fps, then a rest. */
  function simulateGesture() {
    const scene = makeScene(30);
    const start = { zoom: 0.38, offset: { x: 120, y: 80 } };
    const gate = new SettledViewGate(start);
    const counts: number[] = [];
    let commits = 0;
    let now = 0;
    for (let frame = 0; frame <= 60; frame++) {
      now = frame * 16;
      const zoom = 0.38 * (1.2 / 0.38) ** (frame / 60);
      gate.observe({ zoom, offset: { x: 120 - frame, y: 80 } }, now);
      if (gate.tick(now)) commits++;
      counts.push(planAt(gate.settled.zoom, scene).labeledIds.length);
    }
    const midGestureCommits = commits;
    now += SETTLE_IDLE_MS;
    const settled = gate.tick(now);
    return { scene, counts, midGestureCommits, settled, gate };
  }

  it("never re-plans mid-gesture, so the label count holds", () => {
    const { counts, midGestureCommits } = simulateGesture();
    expect(midGestureCommits).toBe(0);
    expect(new Set(counts).size).toBe(1);
  });

  it("re-plans once after the view rests", () => {
    const { settled, gate, scene } = simulateGesture();
    expect(settled?.zoom).toBeCloseTo(1.2, 6);
    expect(gate.tick(10_000)).toBeUndefined();
    expect(planAt(settled!.zoom, scene).labeledIds.length).toBeGreaterThan(0);
  });

  it("ignores sub-pixel pans and sub-0.5% zoom noise", () => {
    const gate = new SettledViewGate({ zoom: 1, offset: { x: 0, y: 0 } });
    expect(gate.observe({ zoom: 1.004, offset: { x: 0.4, y: 0 } }, 0)).toBe(
      false,
    );
    expect(gate.observe({ zoom: 1.01, offset: { x: 0, y: 0 } }, 0)).toBe(true);
  });

  it("uses a relative zoom threshold", () => {
    const gate = new SettledViewGate({ zoom: 0.38, offset: { x: 0, y: 0 } });
    // 0.0019 absolute is 0.5% at 0.38×: the old 0.02 absolute threshold
    // would have ignored a 5% change here.
    expect(gate.observe({ zoom: 0.38 * 1.03, offset: { x: 0, y: 0 } }, 0)).toBe(
      true,
    );
    expect(gate.tick(SETTLE_IDLE_MS)?.zoom).toBeCloseTo(0.38 * 1.03, 9);
  });
});
