import { describe, expect, it } from "vitest";
import {
  buildDocsWhere,
  toIsoDateEnd,
  toIsoDateStart,
} from "./docs.queries.shared";

describe("docs date filters", () => {
  it("ignores malformed URL date ranges", () => {
    const where = buildDocsWhere({
      createdFrom: toIsoDateStart("not-a-date"),
      updatedTo: toIsoDateEnd("2026-99-99"),
    });

    expect(where).toEqual(buildDocsWhere({}));
  });

  it("ignores impossible calendar dates instead of rolling them over", () => {
    expect(toIsoDateStart("2026-02-31")).toBeUndefined();
    expect(toIsoDateEnd("2026-02-31")).toBeUndefined();
  });

  it("keeps valid date bounds at local start and end of day", () => {
    expect(toIsoDateStart("2026-05-10")).toBe(
      new Date("2026-05-10T00:00:00").toISOString(),
    );
    expect(toIsoDateEnd("2026-05-10")).toBe(
      new Date("2026-05-10T23:59:59.999").toISOString(),
    );
  });
});

describe("docs path filters", () => {
  it("matches the selected path and its dot-separated descendants", () => {
    expect(
      buildDocsWhere({ pathPrefix: "work", collectionRows: "all" }),
    ).toEqual({
      archivedAt: null,
      AND: [
        {
          OR: [{ path: "work" }, { path: { startsWith: "work." } }],
        },
      ],
    });
  });
});

describe("docs meta filters", () => {
  it("matches a number stored as a number or as text", () => {
    expect(
      buildDocsWhere({
        metaKey: "count",
        metaValue: "3",
        collectionRows: "all",
      }).AND,
    ).toEqual([
      {
        OR: [
          { meta: { path: ["count"], equals: "3" } },
          { meta: { path: ["count"], equals: 3 } },
        ],
      },
    ]);
  });
});

describe("docs collection rows", () => {
  const optedIn = {
    OR: [{ collectionId: null }, { collection: { showRowsInRecent: true } }],
  };

  it("hides rows unless their collection opted in", () => {
    expect(buildDocsWhere({}).AND).toEqual([optedIn]);
  });

  it("shows every row, only rows, or one collection on request", () => {
    expect(buildDocsWhere({ collectionRows: "all" }).AND).toBeUndefined();
    expect(buildDocsWhere({ collectionRows: "only" }).collectionId).toEqual({
      not: null,
    });
    expect(buildDocsWhere({ collectionId: "c1" }).collectionId).toBe("c1");
  });
});
