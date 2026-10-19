import { describe, expect, it } from "vitest";
import type { TimeBlockItem } from "~/services/time-blocks/time-blocks.service";
import { layoutDayBlocks } from "./overlap";

const block = (
  id: string,
  startHour: number,
  endHour: number,
): TimeBlockItem => {
  const at = (hour: number) =>
    new Date(2026, 9, 16, Math.floor(hour), (hour % 1) * 60).toISOString();
  return {
    id,
    title: id,
    startTime: at(startHour),
    endTime: at(endHour),
    color: null,
    isFixedTime: false,
    comments: null,
    noteId: null,
    noteTitle: null,
    createdAt: at(0),
    updatedAt: at(0),
  };
};

const byId = (blocks: TimeBlockItem[]) =>
  Object.fromEntries(
    layoutDayBlocks(blocks).map(({ id, column, columns, span }) => [
      id,
      { column, columns, span },
    ]),
  );

describe("layoutDayBlocks", () => {
  it("gives isolated blocks the full width", () => {
    expect(byId([block("a", 8, 9), block("b", 9, 10)])).toEqual({
      a: { column: 0, columns: 1, span: 1 },
      b: { column: 0, columns: 1, span: 1 },
    });
  });

  it("splits two overlapping blocks into two lanes", () => {
    expect(byId([block("a", 8, 10), block("b", 9, 11)])).toEqual({
      a: { column: 0, columns: 2, span: 1 },
      b: { column: 1, columns: 2, span: 1 },
    });
  });

  it("reuses a freed lane in an overlap chain", () => {
    // a overlaps b, b overlaps c, but a and c do not touch.
    expect(
      byId([block("a", 8, 9.5), block("b", 9, 11), block("c", 10, 12)]),
    ).toEqual({
      a: { column: 0, columns: 2, span: 1 },
      b: { column: 1, columns: 2, span: 1 },
      c: { column: 0, columns: 2, span: 1 },
    });
  });

  it("stretches a block across lanes its neighbors leave free", () => {
    const layout = byId([
      block("long", 8, 12),
      block("x", 8, 9),
      block("y", 8, 9),
      block("late", 10, 11),
    ]);
    expect(layout.late).toEqual({ column: 1, columns: 3, span: 2 });
    expect(layout.y).toEqual({ column: 2, columns: 3, span: 1 });
  });
});
