import { describe, expect, it } from "vitest";
import { aggregate } from "./aggregate";
import {
  applyView,
  matchesFilter,
  operatorsFor,
  orderedProperties,
  sortRows,
  withTitle,
} from "./query";
import type { CollectionProperty, CollectionRow, FilterTree } from "./types";

const options = [
  {
    id: "todo",
    name: "To read",
    color: "gray" as const,
    group: "todo" as const,
  },
  {
    id: "doing",
    name: "Reading",
    color: "blue" as const,
    group: "doing" as const,
  },
  { id: "done", name: "Done", color: "green" as const, group: "done" as const },
];
const tags = [
  { id: "a", name: "Alpha", color: "red" as const },
  { id: "b", name: "Beta", color: "blue" as const },
];
const props: CollectionProperty[] = [
  {
    id: "status",
    name: "Status",
    kind: "status",
    config: { options },
    position: 0,
  },
  { id: "pages", name: "Pages", kind: "number", config: {}, position: 1 },
  {
    id: "tags",
    name: "Tags",
    kind: "multi_select",
    config: { options: tags },
    position: 2,
  },
  { id: "due", name: "Due", kind: "date", config: {}, position: 3 },
  { id: "done", name: "Owned", kind: "checkbox", config: {}, position: 4 },
  { id: "author", name: "Author", kind: "text", config: {}, position: 5 },
];
const byId = new Map(withTitle(props).map((p) => [p.id, p]));
const TODAY = "2026-10-21"; // a Wednesday

const row = (
  id: string,
  title: string,
  properties: CollectionRow["properties"],
  rank: string | null = id,
): CollectionRow => ({
  id,
  title,
  properties,
  rank,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
});

const rows = [
  row("r1", "Dune", {
    status: "done",
    pages: 600,
    tags: ["a"],
    due: { start: "2026-10-20" },
    done: true,
    author: "Herbert",
  }),
  row("r2", "Emma", {
    status: "doing",
    pages: 400,
    tags: ["a", "b"],
    due: { start: "2026-10-25", end: "2026-10-28" },
    author: "Austen",
  }),
  row("r3", "Ficciones", {
    status: "todo",
    pages: 170,
    due: { start: "2026-09-01" },
  }),
  row("r4", "Beloved", {}),
];

const only = (filter: FilterTree) =>
  rows.filter((r) => matchesFilter(r, filter, byId, TODAY)).map((r) => r.id);
const cond = (propertyId: string, op: never | string, value?: unknown) => ({
  id: `${propertyId}-${op}`,
  propertyId,
  op: op as never,
  value,
});

describe("filters", () => {
  it.each([
    ["title contains", cond("title", "contains", "OV"), ["r4"]],
    ["text is empty", cond("author", "is_empty"), ["r3", "r4"]],
    ["text starts with", cond("author", "starts_with", "her"), ["r1"]],
    ["number gt", cond("pages", "gt", 300), ["r1", "r2"]],
    ["number lte", cond("pages", "lte", 400), ["r2", "r3"]],
    ["number empty", cond("pages", "is_empty"), ["r4"]],
    ["status is", cond("status", "is", ["doing"]), ["r2"]],
    ["status is not", cond("status", "is_not", ["doing"]), ["r1", "r3", "r4"]],
    [
      "status group",
      cond("status", "group_is", ["todo", "doing"]),
      ["r2", "r3"],
    ],
    ["multi any of", cond("tags", "any_of", ["b"]), ["r2"]],
    ["multi has all", cond("tags", "contains_all", ["a", "b"]), ["r2"]],
    ["multi none of", cond("tags", "none_of", ["a"]), ["r3", "r4"]],
    ["date before", cond("due", "before", "2026-10-21"), ["r1", "r3"]],
    ["date range is", cond("due", "is", "2026-10-27"), ["r2"]],
    ["date this week (Sun–Sat)", cond("due", "this_week"), ["r1"]],
    ["date past days", cond("due", "past_days", 7), ["r1"]],
    ["date next days", cond("due", "next_days", 5), ["r2"]],
    ["date this month", cond("due", "this_month"), ["r1", "r2"]],
    ["checkbox checked", cond("done", "is_checked"), ["r1"]],
    ["checkbox unchecked", cond("done", "is_unchecked"), ["r2", "r3", "r4"]],
    [
      "blank value is ignored",
      cond("status", "is", []),
      ["r1", "r2", "r3", "r4"],
    ],
    [
      "deleted property is ignored",
      cond("gone", "is_empty"),
      ["r1", "r2", "r3", "r4"],
    ],
  ])("%s", (_label, condition, expected) => {
    expect(only({ conjunction: "and", items: [condition] })).toEqual(expected);
  });

  it("combines with AND/OR and one level of groups", () => {
    const tree: FilterTree = {
      conjunction: "or",
      items: [
        cond("status", "is", ["todo"]),
        {
          id: "g",
          conjunction: "and",
          conditions: [cond("pages", "gt", 500), cond("done", "is_checked")],
        },
      ],
    };
    expect(only(tree)).toEqual(["r1", "r3"]);
  });

  it("offers operators per kind", () => {
    expect(operatorsFor("status")).toContain("group_is");
    expect(operatorsFor("checkbox")).toEqual(["is_checked", "is_unchecked"]);
  });
});

describe("sorting", () => {
  it("sorts by option order, numbers, and puts empty values last both ways", () => {
    const asc = sortRows(
      rows,
      [{ propertyId: "status", direction: "asc" }],
      byId,
    ).map((r) => r.id);
    expect(asc).toEqual(["r3", "r2", "r1", "r4"]);
    const desc = sortRows(
      rows,
      [{ propertyId: "pages", direction: "desc" }],
      byId,
    ).map((r) => r.id);
    expect(desc).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it("breaks ties with the next rule and then manual rank", () => {
    const tied = [
      row("x", "B", { pages: 1 }, "2"),
      row("y", "A", { pages: 1 }, "1"),
      row("z", "C", { pages: 1 }, "3"),
    ];
    expect(
      sortRows(tied, [{ propertyId: "pages", direction: "asc" }], byId).map(
        (r) => r.id,
      ),
    ).toEqual(["y", "x", "z"]);
    expect(
      sortRows(
        tied,
        [
          { propertyId: "pages", direction: "asc" },
          { propertyId: "title", direction: "desc" },
        ],
        byId,
      ).map((r) => r.id),
    ).toEqual(["z", "x", "y"]);
  });
});

describe("applyView", () => {
  it("filters, searches across property values, and sorts", () => {
    const result = applyView(rows, props, { search: "austen" }, TODAY);
    expect(result.map((r) => r.id)).toEqual(["r2"]);
    expect(
      applyView(rows, props, { search: "alpha" }, TODAY).map((r) => r.id),
    ).toEqual(["r1", "r2"]);
  });

  it("orders and hides properties per view", () => {
    const ordered = orderedProperties(props, {
      propertyOrder: ["author", "status"],
      hiddenProperties: ["tags"],
    });
    expect(ordered.map((p) => p.id)).toEqual([
      "author",
      "status",
      "pages",
      "due",
      "done",
    ]);
  });
});

describe("aggregate", () => {
  it("counts and summarizes", () => {
    const pages = props[1]!;
    expect(aggregate(rows, pages, "sum")).toBe("1170");
    expect(aggregate(rows, pages, "avg")).toBe("390.00");
    expect(aggregate(rows, pages, "min")).toBe("170");
    expect(aggregate(rows, pages, "count_empty")).toBe("1");
    expect(aggregate(rows, props[4]!, "percent_checked")).toBe("25%");
    expect(aggregate([], pages, "max")).toBe("—");
    expect(aggregate(rows, pages, "none")).toBe("");
  });
});
