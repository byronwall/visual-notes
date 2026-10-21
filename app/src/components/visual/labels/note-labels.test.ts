import { describe, expect, it } from "vitest";
import {
  buildAnchoredHoveredNoteLabelLayout,
  buildNoteLabelLayouts,
} from "./note-label-layout";
import {
  getVisibleNoteLabelCount,
  rankNoteLabelCandidates,
} from "./note-label-order";
import type { Bounds } from "./label-geometry";
import { makeDocs, overlappingPairs, viewportAt } from "./test-fixtures";

const offset = { x: 200, y: 150 };

/** Labels for the notes inside the viewport, as the canvas computes them. */
function noteLayoutsAt(zoomScale: number, docCount = 80) {
  const { docs, positions } = makeDocs(docCount);
  const viewportBounds = viewportAt({ zoomScale, offset });
  const ranked = rankNoteLabelCandidates({
    docs,
    positions,
    bounds: viewportBounds,
  });
  const count = getVisibleNoteLabelCount({
    visibleCount: ranked.length,
    zoomScale,
  });
  return buildNoteLabelLayouts({
    docs,
    positions,
    labeledIds: new Set(ranked),
    labelOrder: ranked,
    zoomScale,
    labelFontSize: 12.5 / zoomScale,
    viewportBounds,
    maxCount: count,
    skipOverlapping: true,
  });
}

describe("rankNoteLabelCandidates", () => {
  it("ranks notes in view by most recent edit", () => {
    const { docs, positions } = makeDocs(40);
    const ranked = rankNoteLabelCandidates({ docs, positions });
    expect(ranked).toHaveLength(40);
    const updated = ranked.map(
      (id) => docs.find((doc) => doc.id === id)!.updatedAt,
    );
    expect(updated).toEqual(updated.slice().sort().reverse());
  });

  it("only includes positioned notes inside the bounds", () => {
    const { docs, positions } = makeDocs(60);
    positions.delete("doc-3");
    const bounds = { minX: 0, minY: 0, maxX: 300, maxY: 200 };
    const ranked = rankNoteLabelCandidates({ docs, positions, bounds });
    expect(ranked).not.toContain("doc-3");
    for (const id of ranked) {
      const pos = positions.get(id)!;
      expect(pos.x).toBeLessThanOrEqual(300);
      expect(pos.y).toBeLessThanOrEqual(200);
    }
  });

  it("breaks ties by title, then id, regardless of input order", () => {
    const { docs, positions } = makeDocs(30);
    const tied = docs.map((doc) => ({
      ...doc,
      updatedAt: "2026-02-01T00:00:00.000Z",
    }));
    const a = rankNoteLabelCandidates({ docs: tied, positions });
    const b = rankNoteLabelCandidates({
      docs: tied.slice().reverse(),
      positions,
    });
    expect(b).toEqual(a);
  });

  it("is unchanged by a small zoom change", () => {
    expect(noteLayoutsAt(1.515).map((layout) => layout.docId)).toEqual(
      noteLayoutsAt(1.5).map((layout) => layout.docId),
    );
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

  it("moves or drops a label when its box becomes occupied", () => {
    const zoomScale = 1.8;
    const { docs, positions } = makeDocs(40);
    const viewportBounds = viewportAt({ zoomScale, offset });
    const order = rankNoteLabelCandidates({ docs, positions, limit: 6 });
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
        skipOverlapping: true,
      });
    const first = place()[0]!;
    const occupied = {
      minX: first.minX,
      minY: first.minY,
      maxX: first.maxX,
      maxY: first.maxY,
    };
    const placed = place([occupied]);
    expect(placed.length).toBeGreaterThan(0);
    for (const layout of placed) {
      expect(overlappingPairs([occupied, layout])).toEqual([]);
    }
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

  it("skips crowded notes instead of overlapping, up to the count", () => {
    const { docs } = makeDocs(20);
    // Every note in one tiny clump: only a few labels can fit around it.
    const positions = new Map(
      docs.map((doc, index) => [doc.id, { x: 100 + index * 0.5, y: 100 }]),
    );
    const order = docs.map((doc) => doc.id);
    const layouts = buildNoteLabelLayouts({
      docs,
      positions,
      labeledIds: new Set(order),
      labelOrder: order,
      zoomScale: 2,
      labelFontSize: 6.25,
      maxCount: 8,
      skipOverlapping: true,
    });
    expect(layouts.length).toBeGreaterThan(0);
    expect(layouts.length).toBeLessThanOrEqual(8);
    expect(overlappingPairs(layouts)).toEqual([]);
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
