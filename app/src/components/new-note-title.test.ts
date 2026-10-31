import { describe, expect, it } from "vitest";
import { titleFromFirstLine } from "./new-note-title";

const doc = (...content: object[]) => ({ type: "doc", content });
const emptyH1 = { type: "heading", attrs: { level: 1 } };
const para = (text: string) => ({
  type: "paragraph",
  attrs: { id: "p1" },
  content: [{ type: "text", text }],
});

describe("titleFromFirstLine", () => {
  it("leaves a note with a heading alone", () => {
    const note = doc(
      { ...emptyH1, content: [{ type: "text", text: "Title" }] },
      para("Body"),
    );
    expect(titleFromFirstLine(note)).toEqual({ content: note });
  });

  it("promotes a short first line to the heading", () => {
    const { title, content } = titleFromFirstLine(
      doc(emptyH1, { type: "paragraph" }, para("First line"), para("Second")),
    );
    expect(title).toBe("First line");
    expect(content.content?.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
    ]);
    expect(content.content?.[0].attrs).toEqual({ id: "p1", level: 1 });
  });

  it("keeps long text in the body and clips the title", () => {
    const long = `${"word ".repeat(40)}end`;
    const { title, content } = titleFromFirstLine(doc(emptyH1, para(long)));
    expect(title?.length).toBeLessThanOrEqual(81);
    expect(title?.endsWith("…")).toBe(true);
    expect(content.content).toEqual([para(long)]);
  });

  it("takes the first line before a hard break", () => {
    const body = {
      type: "paragraph",
      content: [
        { type: "text", text: "Line one" },
        { type: "hardBreak" },
        { type: "text", text: "Line two" },
      ],
    };
    const { title, content } = titleFromFirstLine(doc(emptyH1, body));
    expect(title).toBe("Line one");
    expect(content.content).toEqual([body]);
  });

  it("keeps a block that sits above the first line", () => {
    const image = { type: "image", attrs: { src: "/a.png" } };
    const { title, content } = titleFromFirstLine(
      doc(emptyH1, image, para("Caption")),
    );
    expect(title).toBe("Caption");
    expect(content.content).toEqual([image, para("Caption")]);
  });

  it("drops the empty heading of a blank note", () => {
    const { title, content } = titleFromFirstLine(doc(emptyH1));
    expect(title).toBeUndefined();
    expect(content.content).toEqual([{ type: "paragraph" }]);
  });
});
