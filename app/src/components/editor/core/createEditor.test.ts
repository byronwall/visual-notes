import { getSchema, Node } from "@tiptap/core";
import { marked } from "marked";
import { describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ options: undefined as unknown }));

vi.mock("solid-tiptap", () => ({
  createTiptapEditor: (getOptions: () => unknown) => {
    captured.options = getOptions();
    return () => null;
  },
}));
vi.mock("../extensions/index", () => ({ buildExtensions: () => [] }));

import { createEditor } from "./createEditor";

const schema = getSchema([
  Node.create({ name: "doc", topNode: true, content: "block+" }),
  Node.create({ name: "paragraph", group: "block", content: "inline*" }),
  Node.create({ name: "text", group: "inline" }),
  Node.create({ name: "bulletList", group: "block", content: "listItem+" }),
  Node.create({ name: "listItem", content: "paragraph block*" }),
  Node.create({
    name: "codeBlock",
    group: "block",
    content: "text*",
    addAttributes() {
      return { language: { default: null } };
    },
  }),
  Node.create({ name: "table", group: "block", content: "tableRow+" }),
  Node.create({ name: "tableRow", content: "(tableHeader | tableCell)+" }),
  Node.create({ name: "tableHeader", content: "block+" }),
  Node.create({ name: "tableCell", content: "block+" }),
]);

const tableDocument = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "A" }],
                },
              ],
            },
            {
              type: "tableHeader",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: 'tab\tand "quote"' }],
                },
              ],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "line 1\nline 2" }],
                },
              ],
            },
            { type: "tableCell", content: [{ type: "paragraph" }] },
          ],
        },
      ],
    },
  ],
};

function getSerializer() {
  createEditor(
    () => undefined,
    "",
    async () => "cancel",
  );
  const options = captured.options as {
    editorProps: {
      clipboardTextSerializer: (
        slice: ReturnType<ReturnType<typeof schema.nodeFromJSON>["slice"]>,
      ) => string;
    };
  };
  return options.editorProps.clipboardTextSerializer;
}

function getSlice(json: object, openTableContent = false, selectedRows?: number) {
  const doc = schema.nodeFromJSON(json);
  if (openTableContent) {
    const table = doc.firstChild;
    if (!table) throw new Error("Expected the document to start with a table");
    const wholeDocSlice = doc.slice(0, doc.content.size);
    type SliceConstructor = new (
      content: typeof wholeDocSlice.content,
      openStart: number,
      openEnd: number,
    ) => typeof wholeDocSlice;
    const Slice = wholeDocSlice.constructor as SliceConstructor;
    let content = table.content;
    if (selectedRows) {
      let size = 0;
      for (let index = 0; index < selectedRows; index += 1) {
        size += table.content.child(index).nodeSize;
      }
      content = table.content.cut(0, size);
    }
    return new Slice(content, 1, 1);
  }
  return doc.slice(0, doc.content.size);
}

function serializeSlice(json: object, openTableContent = false) {
  return getSerializer()(getSlice(json, openTableContent));
}

describe("editor clipboard text", () => {
  it("preserves table rows, columns, empty cells, and quoted tabs/newlines", () => {
    expect(serializeSlice(tableDocument)).toBe(
      'A\t"tab\tand ""quote"""\n"line 1\nline 2"\t',
    );
  });

  it("keeps adjacent rows together in an open multi-row table slice", () => {
    const slice = getSlice(tableDocument, true);
    expect(slice.openStart).toBe(1);
    expect(slice.openEnd).toBe(1);
    expect(slice.content.childCount).toBe(2);
    expect(getSerializer()(slice)).toBe(
      'A\t"tab\tand ""quote"""\n"line 1\nline 2"\t',
    );
  });

  it("preserves a trailing empty table row in full and partial selections", () => {
    const oneColumnTable = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "A" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph" }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "unselected" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(serializeSlice(oneColumnTable)).toBe("A\n\nunselected");
    const partialSelection = getSlice(oneColumnTable, true, 2);
    expect(partialSelection.openStart).toBe(1);
    expect(partialSelection.openEnd).toBe(1);
    expect(partialSelection.content.childCount).toBe(2);
    expect(getSerializer()(partialSelection)).toBe("A\n");
  });

  it("keeps trimming trailing empty paragraphs", () => {
    expect(
      serializeSlice({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "A" }],
          },
          { type: "paragraph" },
        ],
      }),
    ).toBe("A");
  });

  it("keeps existing list and fenced code clipboard text", () => {
    expect(
      serializeSlice({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "one" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "two" }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe("- one\n- two");

    expect(
      serializeSlice({
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "text" },
            content: [{ type: "text", text: "x\ny" }],
          },
        ],
      }),
    ).toBe("```text\nx\ny\n```");
  });

  it.each(["```", "````"])(
    "uses a longer fence when code contains %s",
    async (embeddedFence) => {
      const raw = `before\n${embeddedFence}\nafter`;
      const fence = "`".repeat(embeddedFence.length + 1);
      const serialized = serializeSlice({
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "text" },
            content: [{ type: "text", text: raw }],
          },
        ],
      });

      expect(serialized).toBe(`${fence}text\n${raw}\n${fence}`);
      expect(await marked.parse(serialized)).toBe(
        `<pre><code class="language-text">${raw}\n</code></pre>\n`,
      );
    },
  );

  it("keeps a partial code block as plain text", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "text" },
          content: [{ type: "text", text: "before\n```\nafter" }],
        },
      ],
    });
    const slice = doc.slice(1, doc.content.size);

    expect(slice.openStart).toBe(1);
    expect(slice.openEnd).toBe(0);
    expect(getSerializer()(slice)).toBe("before\n```\nafter");
  });
});
