import { describe, expect, it } from "vitest";
import { layoutRail } from "./railLayout";

const items = [
  { id: "a", want: 100, height: 40 },
  { id: "b", want: 110, height: 40 },
  { id: "c", want: 400, height: 40 },
];

describe("layoutRail", () => {
  it("puts each note at its passage and pushes overlaps down", () => {
    const y = layoutRail(items, null, 6);
    expect([y.get("a"), y.get("b"), y.get("c")]).toEqual([100, 146, 400]);
  });

  it("keeps the active note at its passage and moves earlier ones up", () => {
    const y = layoutRail(items, "b", 6);
    expect([y.get("a"), y.get("b"), y.get("c")]).toEqual([64, 110, 400]);
  });

  it("never places a note above the floor, even to make room", () => {
    const y = layoutRail(
      [
        { id: "a", want: 50, height: 40 },
        { id: "b", want: 52, height: 40 },
      ],
      "b",
      6,
      40,
    );
    expect(y.get("a")).toBe(40);
    expect(y.get("b")).toBe(86);
  });
});
