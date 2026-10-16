import { beforeEach, describe, expect, it, vi } from "vitest";

const { docFindMany, sectionFindMany, snapshotFindMany } = vi.hoisted(() => ({
  docFindMany: vi.fn(),
  sectionFindMany: vi.fn(),
  snapshotFindMany: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({ query: (fn: unknown) => fn }));
vi.mock("~/server/db", () => ({
  prisma: {
    doc: { findMany: docFindMany },
    docSection: { findMany: sectionFindMany },
    docActivitySnapshot: { findMany: snapshotFindMany },
  },
}));
vi.mock("~/server/events/action-events", () => ({
  logActionEvent: vi.fn(),
}));

import { searchDocs } from "./docs.queries.search";
import { logActionEvent } from "~/server/events/action-events";

describe("searchDocs single-character queries", () => {
  beforeEach(() => {
    docFindMany.mockReset();
    sectionFindMany.mockReset();
    snapshotFindMany.mockReset();
    vi.mocked(logActionEvent).mockReset();
    docFindMany.mockResolvedValue([
      {
        id: "c-note",
        title: "C",
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        path: "languages/c.md",
        share: null,
      },
    ]);
    sectionFindMany.mockResolvedValue([
      {
        id: "section-1",
        text: "A note about C syntax.",
        doc: {
          id: "content-note",
          title: "Language notes",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          path: "languages/notes.md",
          share: null,
        },
      },
    ]);
    snapshotFindMany.mockResolvedValue([]);
  });

  it("matches C across title, path, and content and preserves C++ tokenization", async () => {
    const results = await searchDocs({ q: "C" });

    expect(docFindMany.mock.calls[0]?.[0].where.OR).toContainEqual({
      title: { contains: "C", mode: "insensitive" },
    });
    expect(docFindMany.mock.calls[0]?.[0].where.OR).toContainEqual({
      path: { contains: "C", mode: "insensitive" },
    });
    expect(sectionFindMany.mock.calls[0]?.[0].where.OR).toContainEqual({
      text: { contains: "C", mode: "insensitive" },
    });
    expect(results.map(({ id }) => id)).toEqual(["c-note", "content-note"]);

    await searchDocs({ q: "C++" });
    expect(sectionFindMany.mock.calls[1]?.[0].where.OR).toContainEqual({
      text: { contains: "C++", mode: "insensitive" },
    });
    expect(vi.mocked(logActionEvent)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ queryPreview: "C++", tokenCount: 1 }),
      }),
    );
  });
});
