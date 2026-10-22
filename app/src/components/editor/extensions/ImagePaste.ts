import { Extension, type Editor } from "@tiptap/core";
import { NodeSelection, Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { toaster } from "~/components/ui/toast";
import {
  createImagePasteState,
  findPlaceholder,
  findReplacing,
  imagePasteDecorations,
  imagePasteKey,
  type ImagePasteAction,
  type UploadSpec,
} from "../images/imagePasteState";
import { imageDimensions } from "../images/prepareImage";
import {
  currentOrigin,
  imageSourceHost,
  importableImageSrc,
  pickImageFilesToUpload,
} from "../images/transferImages";
import {
  importImageUrl,
  ImageUploadError,
  uploadImageBlob,
  uploadImageFromLocalUrl,
} from "../images/uploadImage";

// Every way an image arrives (paste, drop, file picker, replace) ends with
// the bytes in /api/doc-images and the note pointing there. Files show a
// local preview while they upload; images pasted inside HTML are copied in
// from their site afterwards, and ones that cannot be copied are reported.

export type ImagePasteStorage = {
  /** Uploads files and inserts them as images at `pos` (default: cursor). */
  insertFiles: (files: File[], pos?: number) => void;
  /** Uploads a file and swaps it into the image node at `pos`. */
  replaceWithFile: (pos: number, file: File) => void;
  /** Opens the system file picker and inserts what is chosen. */
  pickFiles: (pos?: number) => void;
  /** Retries a failed upload placeholder. */
  retryUpload: (id: string) => void;
  /** Tries again to copy an image src from its site into storage. */
  importSrc: (src: string) => void;
  /** Internal: starts copies for newly marked srcs after each transaction. */
  syncImports: () => void;
  /** Internal: releases preview urls and timers. */
  teardown: () => void;
};

declare module "@tiptap/core" {
  interface Storage {
    imagePaste: ImagePasteStorage;
  }
}

const isImageNode = (node: { type: { name: string } } | null | undefined) =>
  node?.type.name === "image";

/** Alt text from a real file name; clipboard images are all "image.png". */
function altFromFile(file: File): string {
  const base = file.name.replace(/\.[a-z0-9]+$/i, "").trim();
  return /^(image|blob|untitled|pasted.*)$/i.test(base) ? "" : base;
}

export const unwrapImageParagraphs = (html: string) =>
  html.replace(/<p\b[^>]*>\s*((?:<img\b[^>]*>\s*)+)<\/p>/gi, "$1");

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Upload failed";

export const ImagePaste = Extension.create<object, ImagePasteStorage>({
  name: "imagePaste",
  // Ahead of the CSV/markdown paste handlers so image files win.
  priority: 1000,

  addStorage() {
    const noop = () => {};
    return {
      insertFiles: noop,
      replaceWithFile: noop,
      pickFiles: noop,
      retryUpload: noop,
      importSrc: noop,
      syncImports: noop,
      teardown: noop,
    };
  },

  onTransaction() {
    this.storage.syncImports();
  },

  onDestroy() {
    this.storage.teardown();
  },

  addProseMirrorPlugins() {
    const editor = this.editor as Editor;
    const storage = this.storage;
    const getView = (): EditorView | null =>
      editor.isDestroyed ? null : editor.view;
    let nextId = 0;
    const files = new Map<string, File>();
    // Uploads run in parallel but insert in paste order.
    let insertChain: Promise<void> = Promise.resolve();

    const dispatch = (action: ImagePasteAction) => {
      const view = getView();
      if (!view) return;
      view.dispatch(view.state.tr.setMeta(imagePasteKey, action));
    };
    const placeholder = (id: string) => {
      const view = getView();
      return view ? findPlaceholder(view.state, id) : null;
    };

    const forget = (id: string) => {
      const found = placeholder(id);
      if (found) URL.revokeObjectURL(found.spec.previewUrl);
      files.delete(id);
      dispatch({ type: "removePlaceholder", id });
    };

    const runUpload = (id: string) => {
      const file = files.get(id);
      const current = placeholder(id);
      if (!file || !current) return;
      if (current.spec.status !== "uploading") {
        dispatch({
          type: "placeholder",
          spec: { ...current.spec, status: "uploading" },
        });
      }
      const upload = uploadImageBlob(file);
      insertChain = insertChain.then(async () => {
        try {
          const { src } = await upload;
          const found = placeholder(id);
          // The placeholder is gone when the user deleted around it.
          if (!found) return forget(id);
          editor
            .chain()
            .command(({ tr }) => {
              tr.setMeta(imagePasteKey, { type: "removePlaceholder", id });
              return true;
            })
            .insertContentAt(
              found.pos,
              { type: "image", attrs: { src, alt: altFromFile(file) } },
              { updateSelection: false },
            )
            .run();
          URL.revokeObjectURL(found.spec.previewUrl);
          files.delete(id);
        } catch (error) {
          console.warn("[image-paste] upload failed", file.name, error);
          const found = placeholder(id);
          if (!found) return forget(id);
          dispatch({
            type: "placeholder",
            spec: {
              ...found.spec,
              status: "failed",
              message: errorMessage(error),
              retryable:
                !(error instanceof ImageUploadError) || error.retryable,
            },
          });
        }
      });
    };

    /**
     * Images are blocks, so uploads wait between blocks: before an empty or
     * not-yet-typed line, after a finished one, or in a split of the line.
     * Inside a paragraph, the first insert would swallow the others' spot.
     * A drop's position is only roughly aimed, so it snaps to the nearer
     * edge of the line instead of splitting a word.
     */
    const blockAnchor = (
      view: EditorView,
      pos: number,
      mode: "split" | "nearest",
    ): number => {
      const $pos = view.state.doc.resolve(pos);
      const parent = $pos.parent;
      if (!parent.isTextblock || $pos.depth === 0) return pos;
      const offset = $pos.parentOffset;
      const size = parent.content.size;
      if (size === 0 || offset === 0) return $pos.before();
      if (offset === size) return $pos.after();
      if (mode === "nearest") {
        return offset < size / 2 ? $pos.before() : $pos.after();
      }
      view.dispatch(view.state.tr.split(pos));
      return pos + 1;
    };

    const insertFiles = (
      list: File[],
      at?: number,
      mode: "split" | "nearest" = "split",
    ) => {
      const view = getView();
      if (!view || list.length === 0) return;
      if (at === undefined && !view.state.selection.empty) {
        view.dispatch(view.state.tr.deleteSelection());
      }
      const pos = blockAnchor(view, at ?? view.state.selection.from, mode);
      for (const file of list) {
        const id = `upload-${++nextId}`;
        files.set(id, file);
        const spec: UploadSpec = {
          id,
          previewUrl: URL.createObjectURL(file),
          status: "uploading",
        };
        dispatch({ type: "placeholder", pos, spec });
        void imageDimensions(file).then((size) => {
          const found = size && placeholder(id);
          if (!found || found.spec.status !== "uploading") return;
          dispatch({
            type: "placeholder",
            spec: { ...found.spec, aspect: size.width / size.height },
          });
        });
        runUpload(id);
      }
    };

    const replaceWithFile = (pos: number, file: File) => {
      const view = getView();
      if (!view || !isImageNode(view.state.doc.nodeAt(pos))) return;
      const id = `replace-${++nextId}`;
      dispatch({ type: "replaceStart", pos, id });
      uploadImageBlob(file)
        .then(({ src }) => {
          const view = getView();
          const at = view ? findReplacing(view.state, id) : null;
          const node = at === null ? null : view!.state.doc.nodeAt(at);
          if (!view || at === null || !node || !isImageNode(node)) return;
          const tr = view.state.tr.setNodeMarkup(at, undefined, {
            ...node.attrs,
            src,
            alt: node.attrs.alt || altFromFile(file),
          });
          view.dispatch(tr.setMeta(imagePasteKey, { type: "replaceEnd", id }));
        })
        .catch((error) => {
          dispatch({ type: "replaceEnd", id });
          toaster.create({
            title: "Couldn't replace the image",
            description: errorMessage(error),
            type: "error",
          });
        });
    };

    const pickFiles = (pos?: number) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.multiple = true;
      input.addEventListener("change", () => {
        const chosen = Array.from(input.files ?? []);
        if (chosen.length) insertFiles(chosen, pos);
      });
      input.click();
    };

    // Failed copies are grouped per paste so one toast covers them all.
    const failedHosts = new Map<string, number>();
    let failToast: ReturnType<typeof setTimeout> | undefined;
    const reportImportFailure = (src: string, error: unknown) => {
      const host = imageSourceHost(src) || "the pasted content";
      failedHosts.set(host, (failedHosts.get(host) ?? 0) + 1);
      console.warn("[image-paste] import failed", host, error);
      clearTimeout(failToast);
      failToast = setTimeout(() => {
        const total = [...failedHosts.values()].reduce((a, b) => a + b, 0);
        const hosts = [...failedHosts.keys()].join(", ");
        failedHosts.clear();
        const blocked = error instanceof ImageUploadError && !error.retryable;
        toaster.create({
          title: `Couldn't copy ${total === 1 ? "an image" : `${total} images`} from ${hosts}`,
          description: blocked
            ? "The site wouldn't share it (it may need you to be signed in). Copy the image itself, select the broken image, and paste to replace it."
            : "The download failed. Select the image and use Retry, or paste the image itself.",
          type: "warning",
          duration: 10_000,
        });
      }, 250);
    };

    const started = new Set<string>();
    const swapSrc = (from: string, to: string) => {
      const view = getView();
      if (!view) return;
      const tr = view.state.tr;
      view.state.doc.descendants((node, pos) => {
        if (isImageNode(node) && node.attrs.src === from) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: to });
        }
      });
      // Swapping the bytes in is not an edit to undo; undo removes the paste.
      tr.setMeta("addToHistory", false);
      view.dispatch(
        tr.setMeta(imagePasteKey, { type: "importDone", src: from }),
      );
    };

    const startImport = (src: string) => {
      if (started.has(src)) return;
      started.add(src);
      const kind = importableImageSrc(src, currentOrigin());
      const task =
        kind === "remote" ? importImageUrl(src) : uploadImageFromLocalUrl(src);
      task
        .then((result) => swapSrc(src, result.src))
        .catch((error) => {
          reportImportFailure(src, error);
          dispatch({ type: "importDone", src });
        })
        .finally(() => started.delete(src));
    };

    const importSrc = (src: string) => {
      if (!importableImageSrc(src, currentOrigin())) return;
      // The view hook below starts the copy once the src is marked.
      dispatch({ type: "import", src });
    };

    Object.assign(storage, {
      insertFiles,
      replaceWithFile,
      pickFiles,
      retryUpload: runUpload,
      importSrc,
      syncImports: () =>
        imagePasteKey.getState(editor.state)?.importing.forEach(startImport),
      teardown: () => {
        clearTimeout(failToast);
        const view = getView();
        for (const id of [...files.keys()]) {
          const found = view && findPlaceholder(view.state, id);
          if (found) URL.revokeObjectURL(found.spec.previewUrl);
        }
        files.clear();
      },
    });

    return [
      new Plugin({
        key: imagePasteKey,
        state: createImagePasteState({ retry: runUpload, remove: forget }),
        props: {
          decorations: imagePasteDecorations,
          // `<p><img></p>` (ChatGPT, Google Docs) would leave an empty line
          // beside each image block; lift the image out of its paragraph.
          transformPastedHTML: unwrapImageParagraphs,
          handlePaste(view, event) {
            const dt = event.clipboardData;
            if (!dt) return false;
            const picked = pickImageFilesToUpload(dt);
            if (!picked) return false;
            event.preventDefault();
            const { selection } = view.state;
            // Pasting onto a selected image swaps its picture, keeping width.
            if (
              selection instanceof NodeSelection &&
              isImageNode(selection.node) &&
              picked.length === 1
            ) {
              replaceWithFile(selection.from, picked[0]!);
              return true;
            }
            insertFiles(picked);
            return true;
          },
          handleDrop(view, event, _slice, moved) {
            if (moved) return false;
            const dt = event.dataTransfer;
            if (!dt) return false;
            const picked = pickImageFilesToUpload(dt);
            if (!picked) return false;
            event.preventDefault();
            const hit = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            const target =
              hit?.inside != null && hit.inside >= 0
                ? view.state.doc.nodeAt(hit.inside)
                : null;
            if (isImageNode(target) && picked.length === 1) {
              replaceWithFile(hit!.inside, picked[0]!);
              return true;
            }
            insertFiles(
              picked,
              hit?.pos ?? view.state.selection.from,
              "nearest",
            );
            return true;
          },
        },
      }),
    ];
  },
});
