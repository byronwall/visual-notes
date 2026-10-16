import { beforeEach, describe, expect, it, vi } from "vitest";

const { findDocs, findSnapshots, logActionEvent } = vi.hoisted(() => ({
  findDocs: vi.fn(),
  findSnapshots: vi.fn(),
  logActionEvent: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({ query: (fn: unknown) => fn }));
vi.mock("~/server/db", () => ({
  prisma: {
    doc: { findMany: findDocs },
    docActivitySnapshot: { findMany: findSnapshots },
  },
}));
vi.mock("~/server/events/action-events", () => ({ logActionEvent }));

import { searchDocs } from "./docs.queries.search";

describe("searchDocs single-character queries", () => {
  beforeEach(() => {
    findDocs.mockReset();
    findSnapshots.mockReset().mockResolvedValue([]);
    logActionEvent.mockReset();
    findDocs.mockImplementation((args) => {
      if (args.select?.html) return [];
      return [
        {
          id: "c-note",
          title: "C",
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
          path: "languages/c.md",
          share: null,
        },
      ];
    });
  });

  it("matches single-character title and path queries and keeps C++ tokenization", async () => {
    const results = await searchDocs({ q: "C" });

    expect(findDocs.mock.calls[0]?.[0].where.OR).toContainEqual({
      title: { contains: "C", mode: "insensitive" },
    });
    expect(findDocs.mock.calls[0]?.[0].where.OR).toContainEqual({
      path: { contains: "C", mode: "insensitive" },
    });
    expect(results.map(({ id }) => id)).toEqual(["c-note"]);

    await searchDocs({ q: "C++" });
    expect(findDocs.mock.calls[2]?.[0].where.OR).toContainEqual({
      title: { contains: "C++", mode: "insensitive" },
    });
    expect(vi.mocked(logActionEvent)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ queryPreview: "C++", tokenCount: 1 }),
      })
    );
  });
});
