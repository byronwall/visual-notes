import { describe, expect, it } from "vitest";
import {
  fromHtml,
  normalizeNoteDoc,
  toHtml,
  toMarkdown,
  toPlainText,
} from "./convert";
import { fileAttachmentNodes, fromNoteMarkdown } from "./note-markdown";
import type { NoteDoc } from "./types";

const HASH = "a".repeat(64);
const SRC = `/api/doc-files/${HASH}/Q3%20report%20%281%29.pdf`;

const doc: NoteDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Board pack" }] },
    {
      type: "fileAttachment",
      attrs: {
        src: SRC,
        name: "Q3 report (1).pdf",
        mime: "application/pdf",
        size: 1234,
      },
    },
  ],
};

describe("fileAttachment node", () => {
  it("validates in the shared schema and gets a block id", () => {
    const file = normalizeNoteDoc(doc).content?.[1];
    expect(file?.type).toBe("fileAttachment");
    expect(file?.attrs).toMatchObject({
      src: SRC,
      name: "Q3 report (1).pdf",
      size: 1234,
    });
    expect(typeof file?.attrs?.id).toBe("string");
  });

  it("stores HTML as a download link and reads it back", () => {
    const html = toHtml(normalizeNoteDoc(doc));
    expect(html).toContain("data-file-attachment");
    expect(html).toContain(`<a href="${SRC}" download="Q3 report (1).pdf"`);
    const back = fromHtml(html).content?.[1];
    expect(back?.attrs).toMatchObject({
      src: SRC,
      name: "Q3 report (1).pdf",
      mime: "application/pdf",
      size: 1234,
    });
  });

  it("round-trips through the notes_get markdown dialect", () => {
    const markdown = toMarkdown(normalizeNoteDoc(doc));
    expect(markdown).toBe(`Board pack\n\n[Q3 report (1).pdf](${SRC})`);
    const back = fromNoteMarkdown(markdown);
    const [file] = fileAttachmentNodes(back.content ?? []);
    expect(file?.attrs).toMatchObject({ src: SRC, name: "Q3 report (1).pdf" });
  });

  it("escapes brackets in the name and keeps ids on their line", () => {
    const tricky = normalizeNoteDoc({
      type: "doc",
      content: [
        {
          type: "fileAttachment",
          attrs: {
            id: "file0001",
            src: `/api/doc-files/${HASH}/x.zip`,
            name: "a [draft] \\ v2.zip",
          },
        },
      ],
    });
    const markdown = toMarkdown(tricky, { withIds: true });
    expect(markdown).toBe(
      `[a \\[draft\\] \\\\ v2.zip](/api/doc-files/${HASH}/x.zip) ^file0001`,
    );
    const [file] = fileAttachmentNodes(
      fromNoteMarkdown(markdown).content ?? [],
    );
    expect(file?.attrs?.name).toBe("a [draft] \\ v2.zip");
  });

  it("reads a full app url back as a relative path", () => {
    const back = fromNoteMarkdown(
      `[deck.pptx](https://notes.test/api/doc-files/${HASH}/deck.pptx)`,
    );
    expect(back.content?.[0]?.attrs?.src).toBe(
      `/api/doc-files/${HASH}/deck.pptx`,
    );
  });

  it("leaves other links, and file links inside text, as links", () => {
    const back = fromNoteMarkdown(
      [
        `See [the deck](/api/doc-files/${HASH}/deck.pptx) first.`,
        "[site](https://example.com/a.pdf)",
      ].join("\n\n"),
    );
    expect(back.content?.map((n) => n.type)).toEqual([
      "paragraph",
      "paragraph",
    ]);
  });

  it("gives its name to plain text so search finds it", () => {
    expect(toPlainText(normalizeNoteDoc(doc))).toContain("Q3 report (1).pdf");
  });
});
