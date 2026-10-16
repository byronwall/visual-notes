import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@solidjs/router", () => ({ query: (fn: unknown) => fn }));
vi.mock("~/server/db", () => ({ prisma: { docShare: { findUnique } } }));
vi.mock("~/server/lib/markdown", () => ({
  normalizeMarkdownToHtml: (markdown: string | null) => markdown ?? "",
  sanitizeHtmlContent: (html: string) => html,
}));
vi.mock("./docs.queries", () => ({ buildDocPreviewText: () => "Note preview" }));

import { fetchPublicSharedDoc } from "./doc-shares.queries";

describe("fetchPublicSharedDoc", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findUnique.mockResolvedValue({
      id: "share-1",
      slug: "public-note",
      shareUrl: "/share/public-note",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      doc: {
        id: "doc-1",
        title: "Shared note",
        html: "<p>Public content</p>",
        markdown: "Public content",
        path: "notes/shared.md",
        meta: { privateToken: "must not be public" },
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    });
  });

  it("returns public note fields without private metadata", async () => {
    const result = await fetchPublicSharedDoc("public-note");

    expect(result).toMatchObject({
      id: "doc-1",
      title: "Shared note",
      html: "<p>Public content</p>",
      markdown: "Public content",
      path: "notes/shared.md",
      share: { slug: "public-note" },
      previewText: "Note preview",
    });
    expect(result).not.toHaveProperty("meta");
    expect(findUnique.mock.calls[0][0].select.doc.select).not.toHaveProperty("meta");
  });
});
