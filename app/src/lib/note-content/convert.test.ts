import { describe, expect, it } from "vitest";
import {
  fromHtml,
  fromMarkdown,
  normalizeNoteDoc,
  toHtml,
  toMarkdown,
  toPlainText,
} from "./convert";
import { topLevelHashes } from "./ids";
import type { NoteNode } from "./types";

const ids = (node: NoteNode): string[] => [
  ...(node.attrs?.id ? [node.attrs.id as string] : []),
  ...(node.content ?? []).flatMap(ids),
];

const FIXTURE_HTML = `
<h1>Launch plan</h1>
<p>Some <strong>bold</strong>, <em>italic</em>, <code>code</code>, <mark>hi</mark> and <a href="https://x.dev?utm_source=a">link</a>.</p>
<ul><li><p>one</p><ul><li><p>nested</p></li></ul></li><li><p>two</p></li></ul>
<ol start="3"><li><p>three</p></li></ol>
<blockquote><p>quoted</p></blockquote>
<pre><code class="language-ts">const a = 1;</code></pre>
<img src="https://img.dev/a.png" alt="pic" data-width="50">
<table><tbody><tr><th><p>H1</p></th><th><p>H2</p></th></tr><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>
<hr>
<script>alert(1)</script><div class="weird"><span>loose text</span></div>
`;

describe("note content conversion", () => {
  it("parses legacy HTML into blocks with unique ids on every block", () => {
    const doc = fromHtml(FIXTURE_HTML);
    const all = ids(doc);
    expect(all.length).toBeGreaterThan(10);
    expect(new Set(all).size).toBe(all.length);
    const text = toPlainText(doc);
    expect(text).toContain("Launch plan");
    expect(text).toContain("nested");
    expect(text).toContain("const a = 1;");
    expect(text).toContain("loose text");
    expect(text).not.toContain("alert(1)");
  });

  it("keeps image width and code language through HTML", () => {
    const doc = fromHtml(FIXTURE_HTML);
    const image = doc.content!.find((n) => n.type === "image");
    expect(image?.attrs?.widthPercent).toBe(50);
    const code = doc.content!.find((n) => n.type === "codeBlock");
    expect(code?.attrs?.language).toBe("ts");
    const html = toHtml(doc);
    expect(html).toContain('data-width="50"');
    expect(html).toContain(`data-id="${image?.attrs?.id}"`);
    expect(html).not.toContain("xmlns");
  });

  it("round-trips HTML -> blocks -> HTML -> blocks with stable ids", () => {
    const doc = fromHtml(FIXTURE_HTML);
    const again = fromHtml(toHtml(doc));
    expect(again).toEqual(doc);
    expect(topLevelHashes(again)).toEqual(topLevelHashes(doc));
  });

  it("round-trips markdown text through blocks", () => {
    const md = [
      "# Title",
      "",
      "Para with **bold** and [link](https://a.dev).",
      "",
      "- one",
      "- two",
      "",
      "```js",
      "x()",
      "```",
      "",
      "| a | b |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n");
    const doc = fromMarkdown(md);
    const out = toMarkdown(doc);
    expect(toPlainText(fromMarkdown(out))).toBe(toPlainText(doc));
    expect(out).toContain("# Title");
    expect(out).toContain("**bold**");
    expect(out).toContain("| 1 | 2 |");
  });

  it("tags top-level blocks and list items with ids and strips them on parse", () => {
    const doc = fromMarkdown("# Head\n\n- item\n\npara");
    const withIds = toMarkdown(doc, { withIds: true });
    const headId = doc.content![0].attrs!.id;
    expect(withIds).toContain(`# Head ^${headId}`);
    const reparsed = fromMarkdown(withIds);
    expect(toPlainText(reparsed)).toBe(toPlainText(doc));
  });

  it("rejects structurally invalid content and repairs duplicate ids", () => {
    expect(() =>
      normalizeNoteDoc({ type: "doc", content: [{ type: "bogus" }] }),
    ).toThrow();
    const dup = normalizeNoteDoc({
      type: "doc",
      content: [
        { type: "paragraph", attrs: { id: "same123" }, content: [{ type: "text", text: "a" }] },
        { type: "paragraph", attrs: { id: "same123" }, content: [{ type: "text", text: "b" }] },
      ],
    });
    expect(dup.content![0].attrs!.id).toBe("same123");
    expect(dup.content![1].attrs!.id).not.toBe("same123");
  });
});
