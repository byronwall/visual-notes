import { describe, expect, it } from "vitest";
import { applyBlockOps, UnknownBlockError } from "./block-ops";
import { fromMarkdown, normalizeNoteDoc, toMarkdown } from "./convert";

const doc = normalizeNoteDoc({
  type: "doc",
  content: [
    { type: "heading", attrs: { id: "head0001", level: 2 }, content: [{ type: "text", text: "Plan" }] },
    { type: "paragraph", attrs: { id: "para0001" }, content: [{ type: "text", text: "First" }] },
    {
      type: "bulletList",
      content: [
        { type: "listItem", attrs: { id: "item0001" }, content: [{ type: "paragraph", attrs: { id: "ip000001" }, content: [{ type: "text", text: "one" }] }] },
        { type: "listItem", attrs: { id: "item0002" }, content: [{ type: "paragraph", attrs: { id: "ip000002" }, content: [{ type: "text", text: "two" }] }] },
      ],
    },
  ],
});

const blocks = (md: string) => fromMarkdown(md).content!;

describe("applyBlockOps", () => {
  it("replaces a block, keeping its id, and leaves others byte-identical", () => {
    const next = normalizeNoteDoc(
      applyBlockOps(doc, [{ op: "replace", blockId: "para0001", blocks: blocks("First, **revised**") }]),
    );
    expect(next.content![1].attrs!.id).toBe("para0001");
    expect(toMarkdown(next)).toContain("First, **revised**");
    expect(next.content![0]).toEqual(doc.content![0]);
    expect(next.content![2]).toEqual(doc.content![2]);
  });

  it("inserts after a list item as list items", () => {
    const next = normalizeNoteDoc(
      applyBlockOps(doc, [{ op: "insert_after", blockId: "item0001", blocks: blocks("one and a half") }]),
    );
    expect(toMarkdown(next)).toContain("- one\n- one and a half\n- two");
  });

  it("deletes blocks and removes emptied lists", () => {
    const next = normalizeNoteDoc(
      applyBlockOps(doc, [
        { op: "delete", blockId: "item0001" },
        { op: "delete", blockId: "item0002" },
      ]),
    );
    expect(next.content!.map((n) => n.type)).toEqual(["heading", "paragraph"]);
  });

  it("rejects unknown ids", () => {
    expect(() => applyBlockOps(doc, [{ op: "delete", blockId: "nope" }])).toThrow(UnknownBlockError);
  });
});
