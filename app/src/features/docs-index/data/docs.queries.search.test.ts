import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const date = new Date("2026-10-16T12:00:00.000Z");

const doc = (
  id: string,
  html: string,
  markdown = "",
  path: string | null = null
) => ({
  id,
  title: `Note ${id}`,
  updatedAt: date,
  path,
  html,
  markdown,
  share: null,
});

beforeEach(() => {
  findSnapshots.mockResolvedValue([]);
});

afterEach(() => {
  findDocs.mockReset();
  findSnapshots.mockReset().mockResolvedValue([]);
  logActionEvent.mockReset();
});

describe("searchDocs current body search", () => {
  it("searches current HTML, joins inline text, decodes entities, and falls back to Markdown", async () => {
    const htmlDoc = doc(
      "html-note",
      "<p>newmark caf&eacute; &#x1F600; &amp; un<strong>expected</strong> C/C++</p><p>next block</p>",
      "oldmark must not be searched"
    );
    const markdownDoc = doc(
      "markdown-note",
      "",
      "**markdown**fresh content token markdownvisibleterm"
    );
    const imageOnlyDoc = doc(
      "image-note",
      '<img src="image.png">',
      "fallbackmustnotappear"
    );
    const emptyHtmlDoc = doc(
      "empty-html-note",
      "<p></p>",
      "emptyfallbackmustnotappear"
    );
    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc, emptyHtmlDoc]);

    const results = await searchDocs({ q: "unexpected", take: 20 });
    expect(results.map((item) => item.id)).toContain("html-note");
    expect(results.find((item) => item.id === "html-note")?.snippet).toContain(
      "unexpected"
    );
    expect(findDocs.mock.calls[0]?.[0]).toMatchObject({
      select: { title: true, path: true },
    });

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc, emptyHtmlDoc]);
    const entityResults = await searchDocs({ q: "café", take: 20 });
    expect(entityResults.map((item) => item.id)).toContain("html-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc, emptyHtmlDoc]);
    const numericEntityResults = await searchDocs({ q: "😀", take: 20 });
    expect(numericEntityResults.map((item) => item.id)).toContain("html-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc, emptyHtmlDoc]);
    const staleResults = await searchDocs({ q: "oldmark", take: 20 });
    expect(staleResults.map((item) => item.id)).not.toContain("html-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc]);
    const markdownResults = await searchDocs({ q: "markdownfresh", take: 20 });
    expect(markdownResults.map((item) => item.id)).toContain("markdown-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc, emptyHtmlDoc]);
    const imageFallbackResults = await searchDocs({
      q: "fallbackmustnotappear",
      take: 20,
    });
    expect(imageFallbackResults.map((item) => item.id)).not.toContain("image-note");
    expect(imageFallbackResults.map((item) => item.id)).not.toContain(
      "empty-html-note"
    );

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc, emptyHtmlDoc]);
    const punctuationResults = await searchDocs({ q: "C/C++", take: 20 });
    expect(punctuationResults.map((item) => item.id)).toContain("html-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc, emptyHtmlDoc]);
    const cResults = await searchDocs({ q: "C", take: 20 });
    expect(cResults.map((item) => item.id)).toContain("html-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc, emptyHtmlDoc]);
    const cppResults = await searchDocs({ q: "C++", take: 20 });
    expect(cppResults.map((item) => item.id)).toContain("html-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc, emptyHtmlDoc]);
    const markdownFormattingResults = await searchDocs({
      q: "markdownvisibleterm",
      take: 20,
    });
    expect(markdownFormattingResults.map((item) => item.id)).toContain(
      "markdown-note"
    );

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc, emptyHtmlDoc]);
    const blockSpacingResults = await searchDocs({ q: "next block", take: 20 });
    expect(
      blockSpacingResults.find((item) => item.id === "html-note")?.snippet
    ).toContain("C/C++ next block");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc, emptyHtmlDoc]);
    const blockJoinResults = await searchDocs({ q: "unexpectednext", take: 20 });
    expect(blockJoinResults.map((item) => item.id)).not.toContain("html-note");
  });

  it("scans every filtered page and applies activity ranking and take", async () => {
    const firstPage = Array.from({ length: 250 }, (_, index) =>
      doc(`note-${index}`, "<p>sharedneedle</p>", "", "/keep/item")
    );
    const lastDoc = doc("last-page", "<p>sharedneedle</p>", "", "/keep/last");
    let bodyPage = 0;
    findDocs.mockImplementation(async (args) => {
      if (!args.select?.html) return [];
      expect(args.where).toMatchObject({
        AND: [
          {
            OR: [
              { path: "/keep" },
              { path: { startsWith: "/keep." } },
            ],
          },
        ],
      });
      bodyPage += 1;
      return bodyPage === 1 ? firstPage : [lastDoc];
    });
    findSnapshots.mockResolvedValue([
      {
        docId: "last-page",
        views30d: 900,
        edits30d: 0,
        searchClicks30d: 0,
        lastInteractedAt: null,
      },
    ]);

    const results = await searchDocs({
      q: "sharedneedle",
      pathPrefix: "/keep",
      sortMode: "most_viewed_30d",
      take: 1,
    });

    expect(bodyPage).toBe(2);
    expect(results.map((item) => item.id)).toEqual(["last-page"]);
    expect(findSnapshots).toHaveBeenCalledWith(
      expect.objectContaining({ where: { docId: { in: expect.any(Array) } } })
    );
  });
});
