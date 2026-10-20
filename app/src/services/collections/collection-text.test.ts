import { describe, expect, it, vi } from "vitest";

const now = new Date("2026-10-01T12:00:00.000Z");
vi.mock("~/server/db", () => ({
  prisma: {
    doc: {
      findMany: vi.fn(async () => [
        {
          id: "d1",
          title: "Dune",
          collectionId: "c1",
          collectionRank: "a",
          createdAt: now,
          updatedAt: now,
          properties: { st: "o1", pg: 600, empty: null },
        },
      ]),
    },
    collection: {
      findMany: vi.fn(async () => [
        {
          id: "c1",
          name: "Reading",
          properties: [
            {
              id: "st",
              name: "Status",
              kind: "status",
              position: 0,
              config: {
                options: [
                  { id: "o1", name: "Done", color: "green", group: "done" },
                ],
              },
            },
            {
              id: "pg",
              name: "Pages",
              kind: "number",
              position: 1,
              config: {},
            },
            { id: "au", name: "Author", kind: "text", position: 2, config: {} },
          ],
        },
      ]),
    },
  },
}));

const { collectionTextForNotes } = await import("./collection-text");

describe("collectionTextForNotes", () => {
  it("returns the collection name and non-empty values as text", async () => {
    expect(await collectionTextForNotes(["d1"])).toEqual({
      d1: {
        collection: "Reading",
        properties: { Status: "Done", Pages: "600" },
      },
    });
  });

  it("skips the database for an empty list", async () => {
    expect(await collectionTextForNotes([])).toEqual({});
  });
});
