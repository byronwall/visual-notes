import { describe, expect, it } from "vitest";
import { topLevelHashes } from "./ids";
import { mergeTopLevel } from "./merge";
import type { NoteDoc, NoteNode } from "./types";

const p = (id: string, text: string): NoteNode => ({
  type: "paragraph",
  attrs: { id },
  content: [{ type: "text", text }],
});
const doc = (...content: NoteNode[]): NoteDoc => ({ type: "doc", content });
const texts = (d: NoteDoc) => d.content!.map((n) => `${n.attrs!.id}:${n.content?.[0]?.text}`);

const base = doc(p("a", "A"), p("b", "B"), p("c", "C"));
const baseHashes = topLevelHashes(base);

describe("mergeTopLevel", () => {
  it("keeps edits to different blocks from both sides", () => {
    const mine = doc(p("a", "A mine"), p("b", "B"), p("c", "C"));
    const theirs = doc(p("a", "A"), p("b", "B"), p("c", "C theirs"));
    const r = mergeTopLevel({ baseHashes, mine, theirs });
    expect(texts(r.doc)).toEqual(["a:A mine", "b:B", "c:C theirs"]);
    expect(r.conflicts).toEqual([]);
  });

  it("lets the incoming save win a same-block conflict and reports it", () => {
    const mine = doc(p("a", "A mine"), p("b", "B"), p("c", "C"));
    const theirs = doc(p("a", "A theirs"), p("b", "B"), p("c", "C"));
    const r = mergeTopLevel({ baseHashes, mine, theirs });
    expect(texts(r.doc)).toEqual(["a:A mine", "b:B", "c:C"]);
    expect(r.conflicts).toEqual(["a"]);
  });

  it("treats identical edits on both sides as no conflict", () => {
    const mine = doc(p("a", "same"), p("b", "B"), p("c", "C"));
    const theirs = doc(p("a", "same"), p("b", "B"), p("c", "C"));
    expect(mergeTopLevel({ baseHashes, mine, theirs }).conflicts).toEqual([]);
  });

  it("drops a block deleted on one side and untouched on the other", () => {
    const mine = doc(p("a", "A"), p("c", "C"));
    const theirs = doc(p("a", "A"), p("b", "B"), p("c", "C"));
    expect(texts(mergeTopLevel({ baseHashes, mine, theirs }).doc)).toEqual(["a:A", "c:C"]);
    const mine2 = doc(p("a", "A"), p("b", "B"), p("c", "C"));
    const theirs2 = doc(p("a", "A"), p("c", "C"));
    expect(texts(mergeTopLevel({ baseHashes, mine: mine2, theirs: theirs2 }).doc)).toEqual([
      "a:A",
      "c:C",
    ]);
  });

  it("keeps an edit when the other side deleted the block", () => {
    const mine = doc(p("a", "A"), p("b", "B edited"), p("c", "C"));
    const theirs = doc(p("a", "A"), p("c", "C"));
    expect(texts(mergeTopLevel({ baseHashes, mine, theirs }).doc)).toEqual([
      "a:A",
      "b:B edited",
      "c:C",
    ]);
    const mine2 = doc(p("a", "A"), p("c", "C"));
    const theirs2 = doc(p("a", "A"), p("b", "B edited"), p("c", "C"));
    expect(texts(mergeTopLevel({ baseHashes, mine: mine2, theirs: theirs2 }).doc)).toEqual([
      "a:A",
      "b:B edited",
      "c:C",
    ]);
  });

  it("ignores key order, as Postgres jsonb reorders object keys", () => {
    const reordered = doc(
      { content: [{ text: "A", type: "text" }], attrs: { id: "a" }, type: "paragraph" } as NoteNode,
      p("b", "B"),
      p("c", "C theirs"),
    );
    const mine = doc(p("a", "A"), p("b", "B mine"), p("c", "C"));
    const r = mergeTopLevel({ baseHashes, mine, theirs: reordered });
    expect(r.conflicts).toEqual([]);
    expect(texts(r.doc)).toEqual(["a:A", "b:B mine", "c:C theirs"]);
  });

  it("places blocks added on the stored side after their predecessor", () => {
    const mine = doc(p("a", "A"), p("n1", "new mine"), p("b", "B"), p("c", "C"));
    const theirs = doc(p("a", "A"), p("b", "B"), p("n2", "new theirs"), p("c", "C"));
    expect(texts(mergeTopLevel({ baseHashes, mine, theirs }).doc)).toEqual([
      "a:A",
      "n1:new mine",
      "b:B",
      "n2:new theirs",
      "c:C",
    ]);
  });

  it("puts a stored-side block with no surviving predecessor first", () => {
    const mine = doc(p("b", "B"), p("c", "C"));
    const theirs = doc(p("n0", "top"), p("a", "A"), p("b", "B"), p("c", "C"));
    expect(texts(mergeTopLevel({ baseHashes, mine, theirs }).doc)).toEqual([
      "n0:top",
      "b:B",
      "c:C",
    ]);
  });
});
