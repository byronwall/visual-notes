import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ prisma: {} }));

const { summarizeStoredNote } = await import("./note-summary");

describe("summarizeStoredNote", () => {
  it("takes the first image block as the cover and the block text as the preview", () => {
    const content = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Goal" }] },
        { type: "image", attrs: { src: "https://x.test/a.png" } },
        { type: "paragraph", content: [{ type: "text", text: "Ship it & rest." }] },
      ],
    };
    const summary = summarizeStoredNote({ content });
    expect(summary.coverUrl).toBe("https://x.test/a.png");
    expect(summary.preview).toContain("Goal");
    expect(summary.preview).toContain("Ship it & rest.");
  });

  it("skips oversized inline images", () => {
    const big = `data:image/png;base64,${"A".repeat(400_000)}`;
    const content = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: big } },
        { type: "image", attrs: { src: "https://x.test/b.jpg" } },
      ],
    };
    expect(summarizeStoredNote({ content }).coverUrl).toBe("https://x.test/b.jpg");
  });

  it("reads notes that only have legacy HTML", () => {
    const summary = summarizeStoredNote({
      html: '<p>Notes on <em>Dune</em>.</p><p><img src="https://x.test/c.png"></p>',
    });
    expect(summary.coverUrl).toBe("https://x.test/c.png");
    expect(summary.preview).toContain("Notes on Dune.");
  });

  it("returns empty values for an empty note", () => {
    expect(
      summarizeStoredNote({ content: { type: "doc", content: [{ type: "paragraph" }] } }),
    ).toEqual({ coverUrl: null, preview: "" });
  });
});
