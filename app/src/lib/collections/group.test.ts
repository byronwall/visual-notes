import { describe, expect, it } from "vitest";
import {
  groupRows,
  layoutWeek,
  monthGrid,
  moveDate,
  rankForDrop,
  shiftMonth,
} from "./group";
import type { CollectionProperty, CollectionRow } from "./types";

const status: CollectionProperty = {
  id: "s",
  name: "Status",
  kind: "status",
  position: 0,
  config: {
    options: [
      { id: "todo", name: "To do", color: "gray", group: "todo" },
      { id: "done", name: "Done", color: "green", group: "done" },
    ],
  },
};
const due: CollectionProperty = {
  id: "d",
  name: "Due",
  kind: "date",
  position: 1,
  config: {},
};

const row = (
  id: string,
  properties: CollectionRow["properties"],
  rank: string | null = id,
): CollectionRow => ({
  id,
  title: id,
  properties,
  rank,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
});

describe("groupRows", () => {
  it("buckets by option order and collects missing or unknown values last", () => {
    const groups = groupRows(
      [
        row("a", { s: "done" }),
        row("b", {}),
        row("c", { s: "todo" }),
        row("d", { s: "gone" }),
      ],
      status,
    );
    expect(groups.map((g) => [g.key, g.rows.map((r) => r.id)])).toEqual([
      ["todo", ["c"]],
      ["done", ["a"]],
      [null, ["b", "d"]],
    ]);
  });

  it("hides groups by key", () => {
    expect(
      groupRows([], status, ["todo", "__none__"]).map((g) => g.key),
    ).toEqual(["done"]);
  });
});

describe("rankForDrop", () => {
  const column = [row("x", {}, "b"), row("y", {}, "d")];
  it("brackets the drop position", () => {
    expect(rankForDrop(column, 0)).toEqual({ after: null, before: "b" });
    expect(rankForDrop(column, 1)).toEqual({ after: "b", before: "d" });
    expect(rankForDrop(column, 2)).toEqual({ after: "d", before: null });
  });
});

describe("calendar", () => {
  it("builds six Sunday-first weeks", () => {
    const weeks = monthGrid("2026-10", "2026-10-21");
    expect(weeks).toHaveLength(6);
    expect(weeks[0]![0]!.date).toBe("2026-09-27");
    expect(weeks.flat().find((d) => d.isToday)?.date).toBe("2026-10-21");
  });

  it("shifts months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("lays out ranges in lanes and clips at week edges", () => {
    const spans = layoutWeek(
      [
        row("long", { d: { start: "2026-10-16", end: "2026-10-20" } }),
        row("mid", { d: { start: "2026-10-19", end: "2026-10-21" } }),
        row("late", { d: { start: "2026-10-22" } }),
      ],
      due,
      "2026-10-18",
    );
    expect(
      spans.map((s) => [s.row.id, s.startCol, s.span, s.lane, s.clippedStart]),
    ).toEqual([
      ["long", 0, 3, 0, true],
      ["mid", 1, 3, 1, false],
      ["late", 4, 1, 0, false],
    ]);
  });

  it("moves a range and keeps its length and time", () => {
    expect(
      moveDate(
        { start: "2026-10-01T09:30", end: "2026-10-03T10:00" },
        "2026-10-10",
      ),
    ).toEqual({
      start: "2026-10-10T09:30",
      end: "2026-10-12T10:00",
    });
  });
});
