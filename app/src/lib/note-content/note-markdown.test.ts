import { describe, expect, it } from "vitest";
import { toMarkdown } from "./markdown";
import {
  collectionViewIds,
  fromNoteMarkdown,
  noteLinkTargets,
} from "./note-markdown";
import type { NoteDoc, NoteNode } from "./types";

const types = (doc: NoteDoc) => (doc.content ?? []).map((n) => n.type);
const inline = (node: NoteNode | undefined) => node?.content ?? [];
const strip = (doc: NoteDoc): unknown =>
  JSON.parse(JSON.stringify(doc), (key, value) =>
    key === "id" ? undefined : value,
  );

describe("fromNoteMarkdown", () => {
  it("reads top-level task lines as task refs with their checkbox state", () => {
    const doc = fromNoteMarkdown(
      "Intro\n- [ ] buy **milk**\n- [x] call Sam\n\n- plain item",
    );
    expect(types(doc)).toEqual([
      "paragraph",
      "taskRef",
      "taskRef",
      "bulletList",
    ]);
    const [, open, done] = doc.content!;
    expect(open.attrs).toMatchObject({ status: "waiting", taskId: null });
    expect(inline(open).map((n) => n.text)).toEqual(["buy ", "milk"]);
    expect(inline(open)[1].marks?.[0].type).toBe("bold");
    expect(done.attrs?.status).toBe("complete");
  });

  it("reads [[label|id]] and [[label|id#block]] as note links", () => {
    const doc = fromNoteMarkdown(
      "See [[Pricing|docB]] and [[Hiring|docC#blkC1234]].",
    );
    const links = inline(doc.content![0]).filter((n) => n.type === "noteLink");
    expect(links.map((n) => n.attrs)).toEqual([
      expect.objectContaining({
        docId: "docB",
        blockId: null,
        label: "Pricing",
      }),
      expect.objectContaining({
        docId: "docC",
        blockId: "blkC1234",
        label: "Hiring",
      }),
    ]);
    expect(noteLinkTargets(doc.content!)).toEqual(["docB", "docC"]);
  });

  it("reads #tags but not numbers, headings, code, or escaped hashes", () => {
    const doc = fromNoteMarkdown(
      "# Title\n\nShip #launch (#Q4-plan) for PR #42, keep \\#literal and `#code`.",
    );
    expect(types(doc)).toEqual(["heading", "paragraph"]);
    const tags = inline(doc.content![1])
      .filter((n) => n.type === "tag")
      .map((n) => n.attrs?.name);
    expect(tags).toEqual(["launch", "q4-plan"]);
    const text = inline(doc.content![1])
      .map((n) => n.text ?? "")
      .join("");
    expect(text).toContain("#42");
    expect(text).toContain("#literal");
    expect(text).toContain("#code");
  });

  it("keeps a tag with every allowed character across a round trip", () => {
    const source: NoteDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "tag", attrs: { name: "work/q4_plan-next" } },
            { type: "text", text: " and (" },
            { type: "tag", attrs: { name: "a_b_c" } },
            { type: "text", text: ")." },
          ],
        },
      ],
    };
    const parsed = fromNoteMarkdown(toMarkdown(source));
    expect(
      inline(parsed.content![0])
        .filter((n) => n.type === "tag")
        .map((n) => n.attrs?.name),
    ).toEqual(["work/q4_plan-next", "a_b_c"]);
  });

  it("leaves fenced code alone", () => {
    const doc = fromNoteMarkdown("```\n- [ ] not a task #nottag [[x|y]]\n```");
    expect(types(doc)).toEqual(["codeBlock"]);
    expect(inline(doc.content![0])[0].text?.trimEnd()).toBe(
      "- [ ] not a task #nottag [[x|y]]",
    );
  });

  it("reads collection view placeholders as embeds", () => {
    const doc = fromNoteMarkdown(
      "Above\n\n{{collection-view:view123}}\n\nBelow",
    );
    expect(types(doc)).toEqual(["paragraph", "collectionView", "paragraph"]);
    expect(collectionViewIds(doc.content!)).toEqual(["view123"]);
  });

  it("round-trips notes_get markdown, ids and all", () => {
    const source: NoteDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { id: "p1aaaaaa" },
          content: [
            { type: "text", text: "Link " },
            {
              type: "noteLink",
              attrs: { docId: "doc1", blockId: null, label: "Other" },
            },
            { type: "text", text: " tagged " },
            { type: "tag", attrs: { name: "ideas" } },
            { type: "text", text: " and literal #notatag [brackets]" },
          ],
        },
        {
          type: "taskRef",
          attrs: { id: "t1aaaaaa", taskId: "task1", status: "complete" },
          content: [{ type: "text", text: "Finished thing" }],
        },
        { type: "collectionView", attrs: { id: "v1aaaaaa", viewId: "view9" } },
      ],
    };
    const markdown = toMarkdown(source, { withIds: true });
    expect(markdown).toContain("{{collection-view:view9}} ^v1aaaaaa");
    const parsed = fromNoteMarkdown(markdown);
    expect(toMarkdown(parsed)).toBe(toMarkdown(source));
    const paragraph = strip(parsed) as NoteDoc;
    expect(inline(paragraph.content![0]).map((n) => n.type)).toEqual([
      "text",
      "noteLink",
      "text",
      "tag",
      "text",
    ]);
  });

  it("round-trips note links whose labels hold markup, brackets, or #words", () => {
    const source: NoteDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "noteLink",
              attrs: {
                docId: "d1",
                blockId: null,
                label: "*Draft* [v2] | Q4 #plan",
              },
            },
            { type: "text", text: " after" },
          ],
        },
      ],
    };
    const parsed = fromNoteMarkdown(toMarkdown(source));
    const nodes = inline(parsed.content![0]);
    expect(nodes.map((n) => n.type)).toEqual(["noteLink", "text"]);
    expect(nodes[0].attrs).toMatchObject({
      docId: "d1",
      label: "*Draft*  v2    Q4 #plan",
    });
    expect(noteLinkTargets(parsed.content!)).toEqual(["d1"]);
  });

  it("keeps literal embed placeholder text as text", () => {
    const source: NoteDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "{{collection-view:abc}}" }],
        },
      ],
    };
    const parsed = fromNoteMarkdown(toMarkdown(source));
    expect(types(parsed)).toEqual(["paragraph"]);
    expect(
      inline(parsed.content![0])
        .map((n) => n.text)
        .join(""),
    ).toBe("{{collection-view:abc}}");
  });
});
