import { Extension } from "@tiptap/core";
import { Plugin } from "prosemirror-state";
import { csvTextToTableJson, isProbablyCSV } from "../csv/csvUtils";
import { insertContentOrText } from "../core/insertContentOrText";

type Choice = "table" | "text" | "cancel";
type Source = "paste" | "drop" | "file";

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

    const handleText = (text: string, source: Source) => {
      if (!ask) {
        insertContentOrText(editor, csvTextToTableJson(text), text);
        return true;
      }
      void ask(text, source).then((choice) => {
        if (choice === "cancel") return;
        if (choice === "table") {
          insertContentOrText(editor, csvTextToTableJson(text), text);
        } else {
          insertContentOrText(editor, null, text);
        }
      });
      return true;
    };

    const handleFile = (file: File, source: Source) => {
      file.text().then((text) => handleText(text, source));
      return true;
    };

    return [
      new Plugin({
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
              (x) => x.type === "text/csv" || /\.csv$/i.test(x.name)
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
          handleDrop(_view, event) {
            const dt = event.dataTransfer;
            if (!dt) return false;
            const files = Array.from(dt.files ?? []);
            const f = files.find(
              (x) =>
                x.type === "text/csv" ||
                x.type === "text/tab-separated-values" ||
                x.type === "application/vnd.ms-excel" ||
                /\.csv$/i.test(x.name) ||
                /\.tsv$/i.test(x.name)
            );
            if (!f) return false;
            event.preventDefault();
            return handleFile(f, "drop");
          },
        },
      }),
    ];
  },
});
