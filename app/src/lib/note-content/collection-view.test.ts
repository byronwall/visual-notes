import { describe, expect, it } from "vitest";
import { fromHtml, normalizeNoteDoc, toHtml, toMarkdown } from "./convert";

const doc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Reading list" }] },
    { type: "collectionView", attrs: { viewId: "view123" } },
  ],
};

describe("collectionView node", () => {
  it("validates as part of the shared schema and gets a block id", () => {
    const normalized = normalizeNoteDoc(doc);
    const embed = normalized.content?.[1];
    expect(embed?.type).toBe("collectionView");
    expect(embed?.attrs?.viewId).toBe("view123");
    expect(typeof embed?.attrs?.id).toBe("string");
  });

  it("round-trips through HTML", () => {
    const html = toHtml(normalizeNoteDoc(doc));
    expect(html).toContain('data-collection-view="view123"');
    const back = fromHtml(html);
    expect(back.content?.some((n) => n.type === "collectionView" && n.attrs?.viewId === "view123")).toBe(true);
  });

  it("serializes to markdown without throwing", () => {
    expect(() => toMarkdown(normalizeNoteDoc(doc))).not.toThrow();
  });
});
