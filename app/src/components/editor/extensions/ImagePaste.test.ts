import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it, vi } from "vitest";
import { NoteImage } from "~/lib/note-content/schema";
import { findPlaceholder, imagePasteKey } from "../images/imagePasteState";
import type * as UploadModule from "../images/uploadImage";
import { ImagePaste } from "./ImagePaste";

const upload = vi.hoisted(() => ({
  uploadImageBlob: vi.fn(),
  importImageUrl: vi.fn(),
  uploadImageFromLocalUrl: vi.fn(),
}));

vi.mock("../images/uploadImage", async (original) => ({
  ...(await original<typeof UploadModule>()),
  ...upload,
}));

vi.mock("~/components/ui/toast", () => ({ toaster: { create: vi.fn() } }));

function createEditor(content: object[]) {
  const editor = new Editor({
    element: null,
    enableCoreExtensions: { drop: false, paste: false },
    extensions: [
      StarterKit.configure({ codeBlock: false, code: false }),
      NoteImage.configure({ allowBase64: true }),
      ImagePaste,
    ],
    content: { type: "doc", content },
  });
  // A headless Tiptap editor reports itself destroyed until it has a DOM view.
  Object.defineProperty(editor, "isDestroyed", { get: () => false });
  editor.view.updateState(
    editor.state.reconfigure({ plugins: editor.extensionManager.plugins }),
  );
  const plugin = imagePasteKey.get(editor.state)!;
  return { editor, plugin };
}

const para = (text: string) =>
  text
    ? { type: "paragraph", content: [{ type: "text", text }] }
    : { type: "paragraph" };

const images = (editor: Editor) => {
  const found: Array<Record<string, unknown>> = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "image") found.push(node.attrs);
  });
  return found;
};

function pasteEvent(files: File[], html = "") {
  return {
    clipboardData: {
      files,
      items: [],
      getData: (type: string) => (type === "text/html" ? html : ""),
    },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const file = (name: string) =>
  new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });

describe("pasting image files", () => {
  it("shows a placeholder, then inserts the stored image where the cursor was", async () => {
    const { editor, plugin } = createEditor([para("before"), para("after")]);
    const done = deferred<{ src: string }>();
    upload.uploadImageBlob.mockReturnValueOnce(done.promise);
    editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 1);

    const event = pasteEvent([file("image.png")]);
    expect(
      plugin.props.handlePaste?.call(plugin, editor.view, event, null as never),
    ).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(findPlaceholder(editor.state, "upload-1")?.spec.status).toBe(
      "uploading",
    );

    // Typing elsewhere while the upload runs does not move the image.
    editor.view.dispatch(editor.state.tr.insertText("x", 1));
    done.resolve({ src: "/api/doc-images/aaa.png" });

    await vi.waitFor(() => expect(images(editor)).toHaveLength(1));
    expect(images(editor)[0]).toMatchObject({
      src: "/api/doc-images/aaa.png",
      alt: "",
    });
    expect(editor.state.doc.child(0).textContent).toBe("xbefore");
    expect(findPlaceholder(editor.state, "upload-1")).toBeNull();
    editor.destroy();
  });

  it("inserts several files in paste order even when uploads finish out of order", async () => {
    const { editor, plugin } = createEditor([para("")]);
    const first = deferred<{ src: string }>();
    const second = deferred<{ src: string }>();
    upload.uploadImageBlob
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    editor.commands.setTextSelection(1);
    plugin.props.handlePaste?.call(
      plugin,
      editor.view,
      pasteEvent([file("one.png"), file("two.png")]),
      null as never,
    );
    second.resolve({ src: "/api/doc-images/two.png" });
    first.resolve({ src: "/api/doc-images/one.png" });
    await vi.waitFor(() => expect(images(editor)).toHaveLength(2));
    expect(images(editor).map((a) => a.src)).toEqual([
      "/api/doc-images/one.png",
      "/api/doc-images/two.png",
    ]);
    expect(images(editor).map((a) => a.alt)).toEqual(["one", "two"]);
    editor.destroy();
  });

  it("splits the line when pasted mid-sentence and keeps an empty line typeable", async () => {
    const { editor, plugin } = createEditor([para("hello world"), para("")]);
    upload.uploadImageBlob.mockResolvedValue({
      src: "/api/doc-images/mid.png",
    });
    editor.commands.setTextSelection(6);
    plugin.props.handlePaste?.call(
      plugin,
      editor.view,
      pasteEvent([file("image.png")]),
      null as never,
    );
    await vi.waitFor(() => expect(images(editor)).toHaveLength(1));
    const blocks: string[] = [];
    editor.state.doc.forEach((node) =>
      blocks.push(node.type.name === "image" ? "[image]" : node.textContent),
    );
    expect(blocks).toEqual(["hello", "[image]", " world", ""]);
    upload.uploadImageBlob.mockReset();
    editor.destroy();
  });

  it("keeps a failed upload as a placeholder that can be retried", async () => {
    const { editor, plugin } = createEditor([para("")]);
    upload.uploadImageBlob
      .mockRejectedValueOnce(new Error("Could not reach the server"))
      .mockResolvedValueOnce({ src: "/api/doc-images/ok.png" });
    editor.commands.setTextSelection(1);
    plugin.props.handlePaste?.call(
      plugin,
      editor.view,
      pasteEvent([file("image.png")]),
      null as never,
    );
    await vi.waitFor(() =>
      expect(findPlaceholder(editor.state, "upload-1")?.spec).toMatchObject({
        status: "failed",
        message: "Could not reach the server",
      }),
    );
    expect(images(editor)).toHaveLength(0);

    editor.storage.imagePaste.retryUpload("upload-1");
    await vi.waitFor(() =>
      expect(images(editor)[0]?.src).toBe("/api/doc-images/ok.png"),
    );
    expect(findPlaceholder(editor.state, "upload-1")).toBeNull();
    editor.destroy();
  });

  it("swaps the picture of a selected image instead of inserting a new one", async () => {
    const { editor, plugin } = createEditor([
      {
        type: "image",
        attrs: {
          src: "https://gone.test/x.png",
          alt: "Frames",
          widthPercent: 50,
        },
      },
    ]);
    upload.uploadImageBlob.mockResolvedValueOnce({
      src: "/api/doc-images/new.png",
    });
    editor.view.dispatch(
      editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)),
    );
    plugin.props.handlePaste?.call(
      plugin,
      editor.view,
      pasteEvent([file("image.png")]),
      null as never,
    );
    await vi.waitFor(() =>
      expect(images(editor)[0]?.src).toBe("/api/doc-images/new.png"),
    );
    expect(images(editor)).toHaveLength(1);
    expect(images(editor)[0]).toMatchObject({
      alt: "Frames",
      widthPercent: 50,
    });
    editor.destroy();
  });

  it("lets rich HTML paste through to the editor", () => {
    const { editor, plugin } = createEditor([para("")]);
    const event = pasteEvent([file("image.png")], "<p>Words</p><img src=x>");
    expect(
      plugin.props.handlePaste?.call(plugin, editor.view, event, null as never),
    ).toBe(false);
    editor.destroy();
  });
});

describe("images pasted inside HTML", () => {
  it("copies another site's image into storage without adding an undo step", async () => {
    const { editor } = createEditor([para("")]);
    upload.importImageUrl.mockResolvedValueOnce({
      src: "/api/doc-images/copied.png",
    });
    const remote =
      "https://chatgpt.com/backend-api/estuary/content?id=file_1&sig=s";
    editor.view.dispatch(
      editor.state.tr
        .replaceSelectionWith(
          editor.schema.nodes.image!.create({
            src: remote,
            alt: "Generated image 1",
          }),
        )
        .setMeta("uiEvent", "paste"),
    );
    expect(imagePasteKey.getState(editor.state)!.importing.has(remote)).toBe(
      true,
    );
    await vi.waitFor(() =>
      expect(images(editor)[0]?.src).toBe("/api/doc-images/copied.png"),
    );
    expect(upload.importImageUrl).toHaveBeenCalledWith(remote);
    expect(imagePasteKey.getState(editor.state)!.importing.size).toBe(0);
    editor.destroy();
  });

  it("uploads inline data: images instead of keeping base64 in the note", async () => {
    const { editor } = createEditor([para("")]);
    upload.uploadImageFromLocalUrl.mockResolvedValueOnce({
      src: "/api/doc-images/inline.png",
    });
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    editor.view.dispatch(
      editor.state.tr
        .replaceSelectionWith(
          editor.schema.nodes.image!.create({ src: dataUrl }),
        )
        .setMeta("uiEvent", "drop"),
    );
    await vi.waitFor(() =>
      expect(images(editor)[0]?.src).toBe("/api/doc-images/inline.png"),
    );
    editor.destroy();
  });

  it("leaves the image's original src when the site refuses, and stops importing", async () => {
    const { editor } = createEditor([para("")]);
    upload.importImageUrl.mockRejectedValueOnce(
      new Error("chatgpt.com answered 403"),
    );
    const remote = "https://chatgpt.com/img";
    editor.view.dispatch(
      editor.state.tr
        .replaceSelectionWith(
          editor.schema.nodes.image!.create({ src: remote }),
        )
        .setMeta("uiEvent", "paste"),
    );
    await vi.waitFor(() =>
      expect(imagePasteKey.getState(editor.state)!.importing.size).toBe(0),
    );
    expect(images(editor)[0]?.src).toBe(remote);
    editor.destroy();
  });

  it("does not touch images that were already in the note", () => {
    const remote = "https://legacy.test/a.png";
    const { editor } = createEditor([
      { type: "image", attrs: { src: remote } },
      para(""),
    ]);
    editor.view.dispatch(
      editor.state.tr
        .insertText("typed", editor.state.doc.content.size - 1)
        .setMeta("uiEvent", "paste"),
    );
    expect(imagePasteKey.getState(editor.state)!.importing.size).toBe(0);
    editor.destroy();
  });
});

describe("unwrapImageParagraphs", () => {
  it("lifts images out of otherwise empty paragraphs only", async () => {
    const { unwrapImageParagraphs } = await import("./ImagePaste");
    expect(
      unwrapImageParagraphs('<p><img src="a"></p><p>Text <img src="b"></p>'),
    ).toBe('<img src="a"><p>Text <img src="b"></p>');
  });
});
