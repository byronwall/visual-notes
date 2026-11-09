import { describe, expect, it } from "vitest";
import type { PathwayGraph, PathwayNode } from "~/lib/pathways/types";
import { assignLanes, layoutMap } from "./layout";

const node = (id: string): PathwayNode => ({
  id,
  kind: id === "root" ? "root" : "option",
  title: id,
  note: "",
  by: "agent",
  status: "open",
});
const map = (ids: string[], edges: [string, string][]): PathwayGraph => ({
  nodes: ids.map(node),
  edges: edges.map(([from, to]) => ({ from, to })),
});

describe("assignLanes", () => {
  it("puts a card reached from two first choices in the shared lane", () => {
    const m = map(
      ["root", "a", "b", "a1", "b1", "both"],
      [
        ["root", "a"],
        ["root", "b"],
        ["a", "a1"],
        ["b", "b1"],
        ["a1", "both"],
        ["b1", "both"],
      ],
    );
    const lanes = assignLanes(m, (id) => ["a", "b"].indexOf(id))!;
    expect(lanes.order).toEqual(["a", "b", "shared"]);
    expect(lanes.lane.get("a1")).toBe("a");
    expect(lanes.lane.get("b1")).toBe("b");
    expect(lanes.lane.get("both")).toBe("shared");
  });

  it("keeps lane cards inside their band, with no overlaps", () => {
    const m = map(
      ["root", "a", "b", "a1", "a2", "b1", "both"],
      [
        ["root", "a"],
        ["root", "b"],
        ["a", "a1"],
        ["a", "a2"],
        ["b", "b1"],
        ["a1", "both"],
        ["b1", "both"],
      ],
    );
    const placed = layoutMap(m, 1200, 800, false, true);
    expect(placed.lanes).toHaveLength(3);
    const boxes = [...placed.boxes.values()];
    for (const p of boxes)
      for (const q of boxes)
        if (p !== q)
          expect(
            p.x + p.w <= q.x ||
              q.x + q.w <= p.x ||
              p.y + p.h <= q.y ||
              q.y + q.h <= p.y,
          ).toBe(true);
    const [laneA] = placed.lanes;
    const a2 = placed.boxes.get("a2")!;
    expect(a2.y).toBeGreaterThanOrEqual(laneA.y);
    expect(a2.y + a2.h).toBeLessThanOrEqual(laneA.y + laneA.h);
  });
});
