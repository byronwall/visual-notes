import { Extension } from "@tiptap/core";
import { Plugin } from "prosemirror-state";
import { csvTextToTableJson, isProbablyCSV } from "../csv/csvUtils";
import { insertContentOrText } from "../core/insertContentOrText";

type Choice = "table" | "text" | "cancel";
type Source = "paste" | "drop" | "file";
type DropTarget = { pos: number };

export const CsvPaste = Extension.create<{
  onPrompt?: (text: string, source: Source) => Promise<Choice>;
}>({
  name: "csvPaste",
  addOptions() {
    return { onPrompt: undefined };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const ask = this.options.onPrompt;
    const pendingDropTargets = new Set<DropTarget>();

    const handleText = (text: string, source: Source, target?: DropTarget) => {
      const insert = (choice: Choice) => {
        if (choice === "cancel" || editor.isDestroyed) {
          if (target) pendingDropTargets.delete(target);
          return;
        }

        if (target) {
          const pos = target.pos;
          pendingDropTargets.delete(target);
          if (choice === "table") {
            editor.chain().insertContentAt(pos, csvTextToTableJson(text)).run();
          } else {
            editor.view.dispatch(editor.state.tr.insertText(text, pos));
          }
          return;
        }

        if (choice === "table") {
          insertContentOrText(editor, csvTextToTableJson(text), text);
        } else {
          insertContentOrText(editor, null, text);
        }
      };

      if (!ask) {
        insert("table");
        return true;
      }
      void ask(text, source).then(insert, () => {
        if (target) pendingDropTargets.delete(target);
      });
      return true;
    };

    const handleFile = (file: File, source: Source, dropPos?: number) => {
      const target =
        source === "drop" && dropPos !== undefined
          ? { pos: dropPos }
          : undefined;
      if (target) pendingDropTargets.add(target);

      void file.text().then(
        (text) => {
          if (editor.isDestroyed) {
            if (target) pendingDropTargets.delete(target);
            return;
          }
          handleText(text, source, target);
        },
        () => {
          if (target) pendingDropTargets.delete(target);
        },
      );
      return true;
    };

    return [
      new Plugin({
        state: {
          init: () => null,
          apply(tr) {
            if (tr.docChanged) {
              for (const target of pendingDropTargets) {
                target.pos = tr.mapping.map(target.pos, 1);
              }
            }
            return null;
          },
        },
        props: {
          handlePaste(_view, event) {
            const dt = event.clipboardData;
            if (!dt) return false;

            const csv = dt.getData("text/csv");
            if (csv && isProbablyCSV(csv)) {
              event.preventDefault();
              return handleText(csv, "paste");
            }

            const files = dt.files && Array.from(dt.files);
            const f = files?.find(
              (x) => x.type === "text/csv" || /\.csv$/i.test(x.name),
            );
            if (f) {
              event.preventDefault();
              return handleFile(f, "file");
            }

            const plain = dt.getData("text/plain");
            if (plain && isProbablyCSV(plain)) {
              event.preventDefault();
              return handleText(plain, "paste");
            }

            return false;
          },
          handleDrop(view, event) {
            const dt = event.dataTransfer;
            if (!dt) return false;
            const files = Array.from(dt.files ?? []);
            const f = files.find(
              (x) =>
                x.type === "text/csv" ||
                x.type === "text/tab-separated-values" ||
                x.type === "application/vnd.ms-excel" ||
                /\.csv$/i.test(x.name) ||
                /\.tsv$/i.test(x.name),
            );
            if (!f) return false;
            event.preventDefault();
            const pos = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            })?.pos;
            return handleFile(f, "drop", pos);
          },
        },
      }),
    ];
  },
});
