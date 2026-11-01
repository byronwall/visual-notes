import { describe, expect, it } from "vitest";
import { computeFacets, type FacetRow } from "./docs.facets";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const row = (over: Partial<FacetRow>): FacetRow => ({
  path: null,
  source: null,
  collectionId: null,
  collectionOptedIn: false,
  updatedAtMs: NOW,
  activityClass: null,
  meta: null,
  ...over,
});
const run = (rows: FacetRow[], filters = {}) =>
  computeFacets(
    rows,
    filters,
    [
      { id: "c1", name: "Reading", icon: null },
      { id: "c2", name: "Feedback", icon: null },
    ],
    NOW,
  );

describe("computeFacets", () => {
  it("leaves hidden collection rows out of totals and counts them", () => {
    const { total, facets } = run([
      row({}),
      row({ collectionId: "c1" }),
      row({ collectionId: "c2", collectionOptedIn: true }),
    ]);
    expect(total).toBe(2);
    expect(facets.hiddenCollectionRows).toBe(1);
    expect(facets.collections.map((c) => [c.name, c.count])).toEqual([
      ["Feedback", 1],
      ["Reading", 1],
    ]);
  });

  it("keeps a facet's siblings when one of its values is selected", () => {
    const rows = [
      row({ path: "work.a", source: "web" }),
      row({ path: "work.b", source: "web" }),
      row({ path: "life", source: "notion" }),
    ];
    const { total, facets } = run(rows, { source: "web" });
    expect(total).toBe(2);
    expect(facets.sources).toEqual([
      { value: "web", count: 2 },
      { value: "notion", count: 1 },
    ]);
    // Other facets narrow to the selection.
    expect(facets.paths).toEqual([{ value: "work", count: 2 }]);
  });

  it("lists the children of the selected path", () => {
    const { total, facets } = run(
      [
        row({ path: "work" }),
        row({ path: "work.a.deep" }),
        row({ path: "work.a" }),
        row({ path: "workshop" }),
      ],
      { pathPrefix: "work" },
    );
    expect(total).toBe(3);
    expect(facets.paths).toEqual([{ value: "work.a", count: 2 }]);
  });

  it("counts each rolling window, ignoring the selected one", () => {
    const rows = [
      row({ updatedAtMs: NOW - 60_000 }),
      row({ updatedAtMs: NOW - 3 * 24 * 60 * 60 * 1000 }),
      row({ updatedAtMs: NOW - 90 * 24 * 60 * 60 * 1000 }),
    ];
    const { total, facets } = run(rows, { updatedWithinDays: 1 });
    expect(total).toBe(1);
    expect(facets.updated).toEqual([
      { days: 1, count: 1 },
      { days: 7, count: 2 },
      { days: 30, count: 2 },
    ]);
  });

  it("filters meta by key and offers that key's values", () => {
    const rows = [
      row({ meta: { status: "draft" } }),
      row({ meta: { status: "final" } }),
      row({ meta: { priority: "high" } }),
    ];
    const { total, facets } = run(rows, { metaKey: "status" });
    expect(total).toBe(2);
    expect(facets.metaValues.map((v) => v.value)).toEqual(["draft", "final"]);
  });
});
