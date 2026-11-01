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
import { searchableText } from "~/server/notes/note-store";

const date = new Date("2026-10-16T12:00:00.000Z");

const doc = (
  id: string,
  html: string,
  markdown = "",
  path: string | null = null,
) => ({
  id,
  title: `Note ${id}`,
  updatedAt: date,
  path,
  searchText: searchableText({ html, markdown }),
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

describe("searchDocs indexed body search", () => {
  it("preserves decoded text, punctuation, and snippets", async () => {
    const htmlDoc = doc(
      "html-note",
      "<p>newmark caf&eacute; &#x1F600; &amp; un<strong>expected</strong> C/C++</p><p>next block</p>",
      "oldmark must not be searched",
    );
    const markdownDoc = doc(
      "markdown-note",
      "",
      "**markdown**fresh content token markdownvisibleterm",
    );
    const imageOnlyDoc = doc(
      "image-note",
      '<img src="image.png">',
      "fallbackmustnotappear",
    );
    const emptyHtmlDoc = doc(
      "empty-html-note",
      "<p></p>",
      "emptyfallbackmustnotappear",
    );
    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        htmlDoc,
        markdownDoc,
        imageOnlyDoc,
        emptyHtmlDoc,
      ]);

    const results = await searchDocs({ q: "unexpected", take: 20 });
    expect(results.map((item) => item.id)).toContain("html-note");
    expect(results.find((item) => item.id === "html-note")?.snippet).toContain(
      "unexpected",
    );
    expect(findDocs.mock.calls[0]?.[0]).toMatchObject({
      select: { title: true, path: true },
    });

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        htmlDoc,
        markdownDoc,
        imageOnlyDoc,
        emptyHtmlDoc,
      ]);
    const entityResults = await searchDocs({ q: "café", take: 20 });
    expect(entityResults.map((item) => item.id)).toContain("html-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        htmlDoc,
        markdownDoc,
        imageOnlyDoc,
        emptyHtmlDoc,
      ]);
    const numericEntityResults = await searchDocs({ q: "😀", take: 20 });
    expect(numericEntityResults.map((item) => item.id)).toContain("html-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        htmlDoc,
        markdownDoc,
        imageOnlyDoc,
        emptyHtmlDoc,
      ]);
    const staleResults = await searchDocs({ q: "oldmark", take: 20 });
    expect(staleResults.map((item) => item.id)).not.toContain("html-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([htmlDoc, markdownDoc, imageOnlyDoc]);
    const markdownResults = await searchDocs({ q: "markdownfresh", take: 20 });
    expect(markdownResults.map((item) => item.id)).toContain("markdown-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        htmlDoc,
        markdownDoc,
        imageOnlyDoc,
        emptyHtmlDoc,
      ]);
    const imageFallbackResults = await searchDocs({
      q: "fallbackmustnotappear",
      take: 20,
    });
    expect(imageFallbackResults.map((item) => item.id)).not.toContain(
      "image-note",
    );
    expect(imageFallbackResults.map((item) => item.id)).not.toContain(
      "empty-html-note",
    );

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        htmlDoc,
        markdownDoc,
        imageOnlyDoc,
        emptyHtmlDoc,
      ]);
    const punctuationResults = await searchDocs({ q: "C/C++", take: 20 });
    expect(punctuationResults.map((item) => item.id)).toContain("html-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        htmlDoc,
        markdownDoc,
        imageOnlyDoc,
        emptyHtmlDoc,
      ]);
    const cResults = await searchDocs({ q: "C", take: 20 });
    expect(cResults.map((item) => item.id)).toContain("html-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        htmlDoc,
        markdownDoc,
        imageOnlyDoc,
        emptyHtmlDoc,
      ]);
    const cppResults = await searchDocs({ q: "C++", take: 20 });
    expect(cppResults.map((item) => item.id)).toContain("html-note");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        htmlDoc,
        markdownDoc,
        imageOnlyDoc,
        emptyHtmlDoc,
      ]);
    const markdownFormattingResults = await searchDocs({
      q: "markdownvisibleterm",
      take: 20,
    });
    expect(markdownFormattingResults.map((item) => item.id)).toContain(
      "markdown-note",
    );

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        htmlDoc,
        markdownDoc,
        imageOnlyDoc,
        emptyHtmlDoc,
      ]);
    const blockSpacingResults = await searchDocs({ q: "next block", take: 20 });
    expect(
      blockSpacingResults.find((item) => item.id === "html-note")?.snippet,
    ).toContain("C/C++ next block");

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        htmlDoc,
        markdownDoc,
        imageOnlyDoc,
        emptyHtmlDoc,
      ]);
    const blockJoinResults = await searchDocs({
      q: "unexpectednext",
      take: 20,
    });
    expect(blockJoinResults.map((item) => item.id)).not.toContain("html-note");
  });

  it("ranks every matching page with activity filters before applying take", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) =>
      doc(`note-${index}`, "<p>sharedneedle</p>", "", "/keep.item"),
    );
    const lastDoc = doc("last-page", "<p>sharedneedle</p>", "", "/keep.last");
    let bodyPage = 0;
    findDocs.mockImplementation(async (args) => {
      if (!args.select?.searchText) return [];
      expect(args.where.AND[0]).toMatchObject({
        AND: [{ OR: [{ path: "/keep" }, { path: { startsWith: "/keep." } }] }],
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
      collectionRows: "all",
      sortMode: "most_viewed_30d",
      take: 1,
    });

    expect(bodyPage).toBe(2);
    expect(results.map((item) => item.id)).toEqual(["last-page"]);
    expect(findSnapshots).toHaveBeenCalledWith(
      expect.objectContaining({ where: { docId: { in: expect.any(Array) } } }),
    );
  });
});

describe("searchDocs single-character queries", () => {
  it("matches title, path, and current body and preserves C++ tokenization", async () => {
    const titleDoc = {
      ...doc("c-note", ""),
      title: "C",
      path: "languages/c.md",
    };
    const bodyDoc = {
      ...doc("content-note", "<p>A note about C syntax.</p>"),
      title: "Language notes",
    };
    findDocs.mockResolvedValueOnce([titleDoc]).mockResolvedValueOnce([bodyDoc]);
    const results = await searchDocs({ q: "C" });
    expect(findDocs.mock.calls[0]?.[0].where.OR).toContainEqual({
      title: { contains: "C", mode: "insensitive" },
    });
    expect(findDocs.mock.calls[0]?.[0].where.OR).toContainEqual({
      path: { contains: "C", mode: "insensitive" },
    });
    expect(results.map(({ id }) => id)).toEqual(["c-note", "content-note"]);

    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([doc("cpp-note", "<p>C++ syntax.</p>")]);
    const cppResults = await searchDocs({ q: "C++" });
    expect(cppResults.map(({ id }) => id)).toContain("cpp-note");
    expect(logActionEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          queryPreview: "C++",
          tokenCount: 1,
        }),
      }),
    );
  });
});

describe("searchDocs database candidates", () => {
  it("filters by literal body substrings without loading source content", async () => {
    findDocs.mockResolvedValue([]);
    await searchDocs({ q: "50% some_path C:\\notes" });
    expect(findDocs.mock.calls[0][0].where.OR[0]).toEqual({
      title: { contains: "50\\% some\\_path C:\\\\notes", mode: "insensitive" },
    });
    const body = findDocs.mock.calls[1][0];
    expect(body.select.searchText).toBe(true);
    expect(body.select).not.toHaveProperty("html");
    expect(body.select).not.toHaveProperty("markdown");
    expect(body.select).not.toHaveProperty("content");
    expect(body.where.AND[1].OR).toContainEqual({
      searchText: { contains: "50\\%", mode: "insensitive" },
    });
    expect(body.where.AND[1].OR).toContainEqual({
      searchText: { contains: "some\\_path", mode: "insensitive" },
    });
    expect(body.where.AND[1].OR).toContainEqual({
      searchText: { contains: "c:\\\\notes", mode: "insensitive" },
    });
  });

  it("keeps tokens split between title and body and rejects incomplete matches", async () => {
    findDocs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { ...doc("match", "<p>camping gear</p>"), title: "Scout trip" },
        doc("incomplete", "<p>camping gear</p>"),
      ]);
    expect(
      (await searchDocs({ q: "scout camping" })).map((hit) => hit.id),
    ).toEqual(["match"]);
  });
});
