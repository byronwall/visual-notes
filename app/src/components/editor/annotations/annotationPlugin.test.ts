import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import type { AnnotationView } from "~/lib/annotations/types";
import { noteSchema } from "~/lib/note-content/convert";
import {
  anchorChanges,
  annotationRanges,
  createAnnotationPlugin,
  selectionPassage,
  setAnnotationsMeta,
} from "./annotationPlugin";

const para = (id: string, text: string) => ({
  type: "paragraph",
  attrs: { id },
  content: [{ type: "text", text }],
});

const ann = (over: Partial<AnnotationView>): AnnotationView => ({
  id: "n1",
  docId: "d",
  taskId: null,
  status: null,
  claimedBy: null,
  messages: [],
  typeId: "t",
  body: "",
  author: "you",
  blockId: "b",
  quote: "the cat",
  quoteStart: 0,
  endBlockId: null,
  endOffset: null,
  detached: false,
  createdAt: "",
  updatedAt: "1",
  ...over,
});

function setup(annotations: AnnotationView[]) {
  const doc = noteSchema().nodeFromJSON({
    type: "doc",
    content: [para("a", "Intro line"), para("b", "the cat sat by the cat door")],
  });
  let state = EditorState.create({ doc, plugins: [createAnnotationPlugin({ select: () => {} })] });
  const [meta, value] = setAnnotationsMeta({ annotations, colors: {}, activeId: null });
  state = state.apply(state.tr.setMeta(meta, value));
  return state;
}

const textOf = (state: EditorState, id: string) => {
  const range = annotationRanges(state).get(id)!;
  return state.doc.textBetween(range.from, range.to);
};

describe("annotation anchors", () => {
  it("picks the repeat nearest the stored start", () => {
    const state = setup([ann({ quoteStart: 14 })]);
    const range = annotationRanges(state).get("n1")!;
    // The second "the" starts at offset 15; block "b" content starts at 13.
    expect(range.from).toBe(28);
    expect(textOf(state, "n1")).toBe("the cat");
  });

  it("follows an edit in another block and reports no change to store", () => {
    let state = setup([ann({})]);
    state = state.apply(state.tr.insertText("New ", 1));
    expect(textOf(state, "n1")).toBe("the cat");
    expect(anchorChanges(state)).toEqual([]);
  });

  it("follows an edit inside the passage and reports the new quote", () => {
    let state = setup([ann({})]);
    const range = annotationRanges(state).get("n1")!;
    state = state.apply(state.tr.insertText("big ", range.from + 4));
    expect(textOf(state, "n1")).toBe("the big cat");
    expect(anchorChanges(state)).toEqual([
      { id: "n1", blockId: "b", quote: "the big cat", quoteStart: 0, endBlockId: null, endOffset: null, detached: false },
    ]);
  });

  it("marks the annotation detached when its passage is deleted", () => {
    let state = setup([ann({})]);
    const range = annotationRanges(state).get("n1")!;
    state = state.apply(state.tr.delete(range.from, range.to));
    expect(annotationRanges(state).has("n1")).toBe(false);
    expect(anchorChanges(state)[0]).toMatchObject({ id: "n1", detached: true });
  });

  it("reads a selection across blocks as one passage and draws it again after a reload", () => {
    const state = setup([]);
    // From "line" in block a (offset 6) to "the cat" at the start of block b.
    const selected = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 7, 20)));
    const passage = selectionPassage(selected)!;
    expect(passage).toMatchObject({ blockId: "a", quoteStart: 6, endBlockId: "b", endOffset: 7, quote: "line\nthe cat" });

    const reloaded = setup([ann({ blockId: "a", quote: passage.quote, quoteStart: 6, endBlockId: "b", endOffset: 7 })]);
    const range = annotationRanges(reloaded).get("n1")!;
    expect([range.from, range.to]).toEqual([7, 20]);
    // Typing inside the span keeps one passage and reports the new end.
    const typed = reloaded.apply(reloaded.tr.insertText("tabby ", 17));
    expect(anchorChanges(typed)[0]).toMatchObject({ quote: "line\nthe tabby cat", endBlockId: "b", endOffset: 13 });
  });

  it("reads the selected passage with its block and offset", () => {
    const state = setup([]);
    const selected = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, 17, 20)),
    );
    expect(selectionPassage(selected)).toMatchObject({ blockId: "b", quote: "cat", quoteStart: 4 });
  });
});
