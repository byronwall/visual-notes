import { Extension, type Editor } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { blockAnchor } from "../core/blockAnchor";
import {
  createFilePasteState,
  filePasteKey,
  findFilePlaceholder,
  setUploadProgress,
  type FilePasteAction,
} from "../files/filePasteState";
import { FileUploadError, uploadDocFile } from "../files/uploadFile";
import { imageFilesFromTransfer } from "../images/transferImages";

// Any file that is not a picture (PDF, spreadsheet, zip, ...) dropped,
// pasted, or picked becomes an attachment card. Pictures in the same
// transfer go to ImagePaste so they show inline. CSV/TSV files alone are left
// to CsvPaste, which offers to turn them into a table.

export type FilePasteStorage = {
  /** Uploads files at `pos` (default: cursor); pictures show inline. */
  insertFiles: (files: File[], pos?: number) => void;
  /** Opens the system file picker for any file type. */
  pickFiles: (pos?: number) => void;
};

declare module "@tiptap/core" {
  interface Storage {
    filePaste: FilePasteStorage;
  }
}

const TABLE_FILE = /\.(csv|tsv)$/i;

/** Every file in a transfer, from both `files` and `items`, without repeats. */
function filesFromTransfer(dt: DataTransfer): File[] {
  const found: File[] = [];
  const seen = new Set<string>();
  const add = (file: File | null) => {
    if (!file) return;
    const key = `${file.name}|${file.size}|${file.type}|${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(file);
  };
  for (const file of Array.from(dt.files ?? [])) add(file);
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === "file") add(item.getAsFile());
  }
  return found;
}

/**
 * Splits a transfer into attachments and pictures, or null when it holds no
 * attachment (only pictures, a lone table file, or no files at all), so the
 * image, CSV, and HTML handlers run as before.
 */
export function splitTransferFiles(
  dt: DataTransfer,
): { files: File[]; images: File[] } | null {
  const all = filesFromTransfer(dt);
  const images = new Set(imageFilesFromTransfer(dt));
  const isImage = (f: File) =>
    [...images].some(
      (i) => i.name === f.name && i.size === f.size && i.type === f.type,
    );
  const files = all.filter((f) => !isImage(f));
  if (files.length === 0) return null;
  if (
    files.length === 1 &&
    images.size === 0 &&
    TABLE_FILE.test(files[0]!.name)
  )
    return null;
  return { files, images: all.filter(isImage) };
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Upload failed";

export const FilePaste = Extension.create<object, FilePasteStorage>({
  name: "filePaste",
  // Ahead of ImagePaste, so a drop of a PDF and a screenshot keeps both.
  priority: 1001,

  addStorage() {
    const noop = () => {};
    return { insertFiles: noop, pickFiles: noop };
  },

  addProseMirrorPlugins() {
    const editor = this.editor as Editor;
    const getView = (): EditorView | null =>
      editor.isDestroyed ? null : editor.view;
    let nextId = 0;
    const pending = new Map<string, File>();
    // Uploads run in parallel but insert in the order they were given.
    let insertChain: Promise<void> = Promise.resolve();

    const dispatch = (action: FilePasteAction) => {
      const view = getView();
      if (view) view.dispatch(view.state.tr.setMeta(filePasteKey, action));
    };
    const placeholder = (id: string) => {
      const view = getView();
      return view ? findFilePlaceholder(view.state, id) : null;
    };
    const forget = (id: string) => {
      pending.delete(id);
      dispatch({ type: "remove", id });
    };

    const runUpload = (id: string) => {
      const file = pending.get(id);
      const current = placeholder(id);
      if (!file || !current) return;
      if (current.spec.status !== "uploading") {
        dispatch({
          type: "placeholder",
          spec: { ...current.spec, status: "uploading", message: undefined },
        });
      }
      const upload = uploadDocFile(file, (fraction) =>
        setUploadProgress(id, fraction, file.size),
      );
      insertChain = insertChain.then(async () => {
        try {
          const stored = await upload;
          const found = placeholder(id);
          // The placeholder is gone when the user deleted around it.
          if (!found) return forget(id);
          editor
            .chain()
            .command(({ tr }) => {
              tr.setMeta(filePasteKey, { type: "remove", id });
              return true;
            })
            .insertContentAt(
              found.pos,
              {
                type: "fileAttachment",
                attrs: {
                  src: stored.src,
                  name: stored.name,
                  mime: stored.mime,
                  size: stored.bytes,
                },
              },
              { updateSelection: false },
            )
            .run();
          pending.delete(id);
        } catch (error) {
          console.warn("[file-paste] upload failed", file.name, error);
          const found = placeholder(id);
          if (!found) return forget(id);
          dispatch({
            type: "placeholder",
            spec: {
              ...found.spec,
              status: "failed",
              message: errorMessage(error),
              retryable: !(error instanceof FileUploadError) || error.retryable,
            },
          });
        }
      });
    };

    /** Placeholders and pictures share one spot between blocks. */
    const insertSplit = (
      split: { files: File[]; images: File[] },
      at?: number,
      mode: "split" | "nearest" = "split",
    ) => {
      const view = getView();
      if (!view) return;
      if (at === undefined && !view.state.selection.empty) {
        view.dispatch(view.state.tr.deleteSelection());
      }
      const pos = blockAnchor(view, at ?? view.state.selection.from, mode);
      for (const file of split.files) {
        const id = `file-${++nextId}`;
        pending.set(id, file);
        dispatch({
          type: "placeholder",
          pos,
          spec: { id, name: file.name, size: file.size, status: "uploading" },
        });
        runUpload(id);
      }
      if (split.images.length) {
        editor.storage.imagePaste?.insertFiles(split.images, pos);
      }
    };

    this.storage.insertFiles = (list, pos) => {
      const images = list.filter((f) => f.type.startsWith("image/"));
      insertSplit(
        { files: list.filter((f) => !images.includes(f)), images },
        pos,
      );
    };
    this.storage.pickFiles = (pos) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.addEventListener("change", () => {
        const chosen = Array.from(input.files ?? []);
        if (chosen.length) this.storage.insertFiles(chosen, pos);
      });
      input.click();
    };

    return [
      new Plugin({
        key: filePasteKey,
        state: createFilePasteState({ retry: runUpload, remove: forget }),
        props: {
          decorations: (state) => filePasteKey.getState(state),
          handlePaste(_view, event) {
            const dt = event.clipboardData;
            const split = dt && splitTransferFiles(dt);
            if (!split) return false;
            event.preventDefault();
            insertSplit(split);
            return true;
          },
          handleDrop(view, event, _slice, moved) {
            if (moved) return false;
            const dt = event.dataTransfer;
            const split = dt && splitTransferFiles(dt);
            if (!split) return false;
            event.preventDefault();
            const hit = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            insertSplit(
              split,
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
