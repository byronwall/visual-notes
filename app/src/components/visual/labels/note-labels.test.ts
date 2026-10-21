import { describe, expect, it } from "vitest";
import {
  buildAnchoredHoveredNoteLabelLayout,
  buildNoteLabelLayouts,
} from "./note-label-layout";
import {
  buildStableNoteLabelOrder,
  getVisibleNoteLabelCount,
} from "./note-label-order";
import type { Bounds } from "./label-geometry";
import { makeDocs, overlappingPairs, viewportAt } from "./test-fixtures";

const offset = { x: 200, y: 150 };

/** Labels for the notes inside the viewport, as the canvas computes them. */
function noteLayoutsAt(zoomScale: number, docCount = 80) {
  const all = makeDocs(docCount);
  const positions = all.positions;
  const viewportBounds = viewportAt({ zoomScale, offset });
  const docs = all.docs.filter((doc) => {
    const pos = positions.get(doc.id)!;
    return (
      pos.x >= viewportBounds.minX &&
      pos.x <= viewportBounds.maxX &&
      pos.y >= viewportBounds.minY &&
      pos.y <= viewportBounds.maxY
    );
  });
  const count = getVisibleNoteLabelCount({
    visibleCount: docs.length,
    zoomScale,
  });
  const order = buildStableNoteLabelOrder({
    docs,
    positions,
    viewportBounds,
    limit: count * 3 + 1,
  }).slice(0, count);
  return buildNoteLabelLayouts({
    docs,
    positions,
    labeledIds: new Set(order),
    labelOrder: order,
    zoomScale,
    labelFontSize: 12.5 / zoomScale,
    viewportBounds,
  });
}

describe("buildStableNoteLabelOrder", () => {
  it("returns each positioned note once", () => {
    const { docs, positions } = makeDocs(40);
    positions.delete("doc-3");
    const order = buildStableNoteLabelOrder({ docs, positions });
    expect(order).toHaveLength(39);
    expect(new Set(order).size).toBe(39);
    expect(order).not.toContain("doc-3");
  });

  it("with a limit, returns a prefix of the full order", () => {
    const { docs, positions } = makeDocs(60);
    const viewportBounds = viewportAt({ zoomScale: 1.5, offset });
    const full = buildStableNoteLabelOrder({ docs, positions, viewportBounds });
    const limited = buildStableNoteLabelOrder({
      docs,
      positions,
      viewportBounds,
      limit: 10,
    });
    expect(limited).toEqual(full.slice(0, 10));
  });

  it("is unchanged by a small pan of the viewport", () => {
    const { docs, positions } = makeDocs(60);
    const at = (dx: number) =>
      buildStableNoteLabelOrder({
        docs,
        positions,
        viewportBounds: viewportAt({
          zoomScale: 1.5,
          offset: { x: offset.x + dx, y: offset.y },
        }),
        limit: 13,
      });
    expect(at(1)).toEqual(at(0));
  });

  it("is unchanged by a small zoom change", () => {
    const { docs, positions } = makeDocs(60);
    const at = (zoomScale: number) =>
      buildStableNoteLabelOrder({
        docs,
        positions,
        viewportBounds: viewportAt({ zoomScale, offset }),
        limit: 13,
      });
    expect(at(1.515)).toEqual(at(1.5));
  });

  it("spreads early picks apart", () => {
    const { docs, positions } = makeDocs(80);
    const [first, second] = buildStableNoteLabelOrder({
      docs,
      positions,
      limit: 2,
    });
    const a = positions.get(first!)!;
    const b = positions.get(second!)!;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(200);
  });
});

describe("getVisibleNoteLabelCount", () => {
  it("grows from 5 to 13 with zoom and never shrinks", () => {
    let previous = 0;
    for (let zoom = 0.5; zoom <= 3; zoom += 0.01) {
      const count = getVisibleNoteLabelCount({
        visibleCount: 100,
        zoomScale: zoom,
      });
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
    expect(getVisibleNoteLabelCount({ visibleCount: 100, zoomScale: 1 })).toBe(
      5,
    );
    expect(getVisibleNoteLabelCount({ visibleCount: 100, zoomScale: 3 })).toBe(
      13,
    );
    expect(getVisibleNoteLabelCount({ visibleCount: 3, zoomScale: 3 })).toBe(3);
  });
});

describe("buildNoteLabelLayouts", () => {
  it.each([1.2, 1.8, 2.6])(
    "places labels without overlapping each other at zoom %s",
    (zoomScale) => {
      const layouts = noteLayoutsAt(zoomScale);
      expect(layouts.length).toBeGreaterThan(0);
      expect(overlappingPairs(layouts)).toEqual([]);
    },
  );

  it("moves a label off a box that becomes occupied", () => {
    const zoomScale = 1.8;
    const { docs, positions } = makeDocs(40);
    const viewportBounds = viewportAt({ zoomScale, offset });
    const order = buildStableNoteLabelOrder({ docs, positions, limit: 6 });
    const place = (occupiedBoxes?: Bounds[]) =>
      buildNoteLabelLayouts({
        docs,
        positions,
        labeledIds: new Set(order),
        labelOrder: order,
        zoomScale,
        labelFontSize: 12.5 / zoomScale,
        viewportBounds,
        occupiedBoxes,
      });
    const first = place()[0]!;
    const occupied = {
      minX: first.minX,
      minY: first.minY,
      maxX: first.maxX,
      maxY: first.maxY,
    };
    const moved = place([occupied]).find(
      (layout) => layout.docId === first.docId,
    )!;
    expect(overlappingPairs([occupied, moved])).toEqual([]);
  });

  it("draws each leader from the note to the edge of its bubble", () => {
    const { positions } = makeDocs(80);
    for (const layout of noteLayoutsAt(1.8)) {
      const pos = positions.get(layout.docId)!;
      expect(layout.leaderStartX).toBe(pos.x);
      expect(layout.leaderStartY).toBe(pos.y);
      expect(layout.leaderEndX).toBeGreaterThanOrEqual(layout.minX);
      expect(layout.leaderEndX).toBeLessThanOrEqual(layout.maxX);
      expect(layout.leaderEndY).toBeGreaterThanOrEqual(layout.minY);
      expect(layout.leaderEndY).toBeLessThanOrEqual(layout.maxY);
    }
  });

  it("only labels notes that are in both the order and the labeled set", () => {
    const { docs, positions } = makeDocs(10);
    const layouts = buildNoteLabelLayouts({
      docs,
      positions,
      labeledIds: new Set(["doc-1", "doc-2"]),
      labelOrder: ["doc-2", "doc-3", "missing"],
      zoomScale: 2,
      labelFontSize: 6.25,
    });
    expect(layouts.map((layout) => layout.docId)).toEqual(["doc-2"]);
  });
});

describe("buildAnchoredHoveredNoteLabelLayout", () => {
  const doc = makeDocs(1).docs[0]!;

  it("sits above and to the right of the note", () => {
    const position = { x: 100, y: 100 };
    const layout = buildAnchoredHoveredNoteLabelLayout({
      doc,
      position,
      zoomScale: 2,
      labelFontSize: 6.25,
    });
    expect(layout.docId).toBe(doc.id);
    expect(layout.minX).toBeGreaterThan(position.x);
    expect(layout.maxY).toBeLessThan(position.y);
    expect(layout.leaderStartX).toBe(position.x);
  });

  it("shifts into the viewport near an edge", () => {
    const viewportBounds = { minX: 0, minY: 0, maxX: 200, maxY: 200 };
    const layout = buildAnchoredHoveredNoteLabelLayout({
      doc,
      position: { x: 195, y: 2 },
      zoomScale: 2,
      labelFontSize: 6.25,
      viewportBounds,
    });
    expect(layout.maxX).toBeCloseTo(viewportBounds.maxX, 9);
    expect(layout.minY).toBeCloseTo(viewportBounds.minY, 9);
  });
});
