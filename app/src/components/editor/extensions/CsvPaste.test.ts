import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import { describe, expect, it, vi } from "vitest";
import { CsvPaste } from "./CsvPaste";

const captured = vi.hoisted(() => ({ insertContentOrText: vi.fn() }));

vi.mock("../core/insertContentOrText", () => ({
  insertContentOrText: captured.insertContentOrText,
}));

const csv = "name,value\nalpha,1\nbeta,2\ngamma,3\ndelta,4\nepsilon,5";

function createEditor(
  onPrompt: (
    text: string,
    source: "paste" | "drop" | "file",
  ) => Promise<"table" | "text" | "cancel">,
) {
  const editor = new Editor({
    element: null,
    enableCoreExtensions: { drop: false, paste: false },
    extensions: [
      StarterKit.configure({ codeBlock: false, code: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      CsvPaste.configure({ onPrompt }),
    ],
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "before" }] },
        { type: "paragraph", content: [{ type: "text", text: "marker" }] },
      ],
    },
  });
  // A headless Tiptap editor reports itself destroyed until it has a DOM view.
  Object.defineProperty(editor, "isDestroyed", { get: () => false });
  editor.view.updateState(
    editor.state.reconfigure({ plugins: editor.extensionManager.plugins }),
  );
  const plugin = editor.state.plugins.find(
    (item) => item.spec.props?.handleDrop,
  );
  if (!plugin) throw new Error("CsvPaste plugin was not registered");

  return { editor, plugin };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function makeDrop(file: File, pos: number) {
  const event = {
    dataTransfer: { files: [file] },
    clientX: 120,
    clientY: 160,
    preventDefault: vi.fn(),
  } as unknown as DragEvent;
  const view = {
    posAtCoords: vi.fn(() => ({ pos })),
  } as never;
  return { event, view };
}

describe("CSV file drops", () => {
  it("inserts at the pointer target after edits during file reading and prompting", async () => {
    const read = deferred<string>();
    const choice = deferred<"table" | "text" | "cancel">();
    const onPrompt = vi.fn(() => choice.promise);
    const { editor, plugin } = createEditor(onPrompt);
    const dropPos = editor.state.doc.child(0).nodeSize + 1;
    const file = {
      name: "sample.csv",
      type: "text/csv",
      text: () => read.promise,
    } as File;
    const { event, view } = makeDrop(file, dropPos);

    const slice = editor.state.doc.slice(0);
    expect(
      plugin.props.handleDrop?.call(plugin, view, event, slice, false),
    ).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();

    editor.view.dispatch(editor.state.tr.insertText("x", 1));
    read.resolve(csv);
    await vi.waitFor(() => expect(onPrompt).toHaveBeenCalledOnce());
    editor.view.dispatch(editor.state.tr.insertText("y", 1));
    choice.resolve("table");
    await vi.waitFor(() =>
      expect(editor.state.doc.child(1).type.name).toBe("table"),
    );

    expect(editor.state.doc.child(0).textContent).toBe("yxbefore");
    expect(editor.state.doc.child(2).textContent).toBe("marker");
    expect(onPrompt).toHaveBeenCalledWith(csv, "drop");
    editor.destroy();
  });

  it("leaves the document unchanged when the prompt is canceled", async () => {
    const onPrompt = vi.fn(async () => "cancel" as const);
    const { editor, plugin } = createEditor(onPrompt);
    const before = editor.state.doc;
    const file = {
      name: "sample.csv",
      type: "text/csv",
      text: async () => csv,
    } as File;
    const { event, view } = makeDrop(
      file,
      editor.state.doc.child(0).nodeSize + 1,
    );

    const slice = editor.state.doc.slice(0);
    plugin.props.handleDrop?.call(plugin, view, event, slice, false);
    await vi.waitFor(() => expect(onPrompt).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(editor.state.doc.eq(before)).toBe(true));

    expect(captured.insertContentOrText).not.toHaveBeenCalled();
    editor.destroy();
  });

  it("inserts dropped CSV text literally at the pointer target", async () => {
    const text = "<b>x</b>,y\n<em>z</em>,q";
    const onPrompt = vi.fn(async () => "text" as const);
    const { editor, plugin } = createEditor(onPrompt);
    const file = {
      name: "sample.csv",
      type: "text/csv",
      text: async () => text,
    } as File;
    const { event, view } = makeDrop(
      file,
      editor.state.doc.child(0).nodeSize + 1,
    );
    const slice = editor.state.doc.slice(0);

    plugin.props.handleDrop?.call(plugin, view, event, slice, false);
    await vi.waitFor(() =>
      expect(editor.state.doc.child(1).textContent).toBe(`${text}marker`),
    );
    expect(onPrompt).toHaveBeenCalledWith(text, "drop");
    editor.destroy();
  });

  it("keeps clipboard CSV insertion on the existing selection-based path", async () => {
    const onPrompt = vi.fn(async () => "text" as const);
    const { editor, plugin } = createEditor(onPrompt);
    const event = {
      clipboardData: {
        getData: (type: string) => (type === "text/csv" ? csv : ""),
        files: [],
      },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent;

    expect(
      plugin.props.handlePaste?.call(
        plugin,
        editor.view,
        event,
        editor.state.doc.slice(0),
      ),
    ).toBe(true);
    await vi.waitFor(() =>
      expect(captured.insertContentOrText).toHaveBeenCalledWith(
        editor,
        null,
        csv,
      ),
    );
    expect(onPrompt).toHaveBeenCalledWith(csv, "paste");
    editor.destroy();
  });
});
