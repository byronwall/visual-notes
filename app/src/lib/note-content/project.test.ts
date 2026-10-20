import { describe, expect, it } from "vitest";
import { normalizeNoteDoc, toMarkdown } from "./convert";
import { projectNote } from "./project";

const doc = normalizeNoteDoc({
  type: "doc",
  content: [
    { type: "heading", attrs: { id: "h1abcdef", level: 1 }, content: [{ type: "text", text: "Plan" }] },
    {
      type: "paragraph",
      attrs: { id: "p1abcdef" },
      content: [
        { type: "text", text: "See " },
        { type: "noteLink", attrs: { docId: "docB", blockId: null, label: "Pricing" } },
        { type: "text", text: " and " },
        { type: "noteLink", attrs: { docId: "docC", blockId: "blkC1234", label: "Hiring" } },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          attrs: { id: "li1abcde" },
          content: [{ type: "paragraph", attrs: { id: "lp1abcde" }, content: [{ type: "text", text: "item" }] }],
        },
      ],
    },
  ],
});

describe("projectNote", () => {
  it("indexes every id-bearing block in document order with parents", () => {
    const { blocks } = projectNote(doc);
    expect(blocks.map((b) => [b.id, b.type, b.parentId, b.topLevelIndex])).toEqual([
      ["h1abcdef", "heading", null, 0],
      ["p1abcdef", "paragraph", null, 1],
      ["li1abcde", "listItem", null, 2],
      ["lp1abcde", "paragraph", "li1abcde", 2],
    ]);
    expect(blocks[1].text).toBe("See Pricing and Hiring");
  });

  it("records note links once, on the block that holds them", () => {
    const { links } = projectNote(doc);
    expect(links).toEqual([
      { sourceBlockId: "p1abcdef", targetDocId: "docB", targetBlockId: null },
      { sourceBlockId: "p1abcdef", targetDocId: "docC", targetBlockId: "blkC1234" },
    ]);
  });

  it("serializes note links as [[label|target]] markdown", () => {
    expect(toMarkdown(doc)).toContain("[[Pricing|docB]] and [[Hiring|docC#blkC1234]]");
  });

  it("changes a block hash only when that block changes", () => {
    const before = projectNote(doc).blocks;
    const edited = structuredClone(doc);
    edited.content![0].content![0].text = "Plan v2";
    const after = projectNote(edited).blocks;
    expect(after[0].hash).not.toBe(before[0].hash);
    expect(after[1].hash).toBe(before[1].hash);
  });
});
