import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { blockHash } from "~/lib/annotations/block-hash";
import type { ProposalOp } from "~/lib/annotations/types";
import { noteSchema } from "~/lib/note-content/convert";
import type { NoteDoc, NoteNode } from "~/lib/note-content/types";
import { proposalTransaction } from "./proposalTransaction";

const para = (id: string, text: string): NoteNode => ({
  type: "paragraph",
  attrs: { id },
  content: [{ type: "text", text }],
});

const doc: NoteDoc = {
  type: "doc",
  content: [
    para("a", "First"),
    para("b", "Second"),
    {
      type: "bulletList",
      content: [
        { type: "listItem", attrs: { id: "li1" }, content: [para("p1", "Only item")] },
      ],
    },
  ],
};

const stateOf = (json: NoteDoc) =>
  EditorState.create({ doc: noteSchema().nodeFromJSON(json) });

const opOn = (
  json: NoteDoc,
  op: Omit<ProposalOp, "baseHash" | "state">,
): ProposalOp => {
  let target: NoteNode | undefined;
  const visit = (node: NoteNode) => {
    if (node.attrs?.id === op.blockId) target = node;
    node.content?.forEach(visit);
  };
  visit(json);
  return { ...op, baseHash: blockHash(target!), state: "pending" };
};

const texts = (state: EditorState) => {
  const out: string[] = [];
  state.doc.forEach((node) => out.push(node.textContent));
  return out;
};

describe("proposalTransaction", () => {
  it("replaces a block and keeps its id", () => {
    const state = stateOf(doc);
    const op = opOn(doc, {
      op: "replace",
      blockId: "b",
      blocks: [para("x", "Rewritten"), para("y", "Extra")],
    });
    const next = state.apply(proposalTransaction(state, op)!);
    expect(texts(next).slice(0, 3)).toEqual(["First", "Rewritten", "Extra"]);
    expect(next.doc.child(1).attrs.id).toBe("b");
  });

  it("inserts after a block", () => {
    const state = stateOf(doc);
    const op = opOn(doc, { op: "insert_after", blockId: "a", blocks: [para("n", "New")] });
    const next = state.apply(proposalTransaction(state, op)!);
    expect(texts(next).slice(0, 3)).toEqual(["First", "New", "Second"]);
  });

  it("deletes a list's only item with its list", () => {
    const state = stateOf(doc);
    const op = opOn(doc, { op: "delete", blockId: "li1" });
    const next = state.apply(proposalTransaction(state, op)!);
    expect(texts(next)).toEqual(["First", "Second"]);
  });

  it("wraps loose blocks into list items inside a list", () => {
    const state = stateOf(doc);
    const op = opOn(doc, { op: "insert_after", blockId: "li1", blocks: [para("q", "Second item")] });
    const next = state.apply(proposalTransaction(state, op)!);
    const list = next.doc.child(2);
    expect(list.childCount).toBe(2);
    expect(list.child(1).type.name).toBe("listItem");
  });

  it("keeps an addition valid after its anchor is rewritten", () => {
    const op = opOn(doc, { op: "insert_after", blockId: "b", blocks: [para("n", "New")] });
    const edited = stateOf({ ...doc, content: [para("a", "First"), para("b", "Edited")] });
    expect(proposalTransaction(edited, op)).not.toBeNull();
  });

  it("refuses a block that changed or is gone", () => {
    const op = opOn(doc, { op: "replace", blockId: "b", blocks: [para("x", "New")] });
    const edited = stateOf({ ...doc, content: [para("a", "First"), para("b", "Edited")] });
    expect(proposalTransaction(edited, op)).toBeNull();
    const gone = stateOf({ ...doc, content: [para("a", "First")] });
    expect(proposalTransaction(gone, op)).toBeNull();
  });
});
