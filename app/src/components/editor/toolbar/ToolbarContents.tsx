import type { Editor } from "@tiptap/core";
import { Control } from "./Control";
import { blocks, marks, listsBlocks, type Btn } from "./toolbarConfig";
import { exec } from "../core/exec";
import { csvTextToTableJson } from "../csv/csvUtils";
import { insertContentOrText } from "../core/insertContentOrText";
import { Separator } from "../ui/Separator";

export function ToolbarContents(props: { editor: Editor }) {
  let csvInputRef: HTMLInputElement | undefined;

  const run = (fn: Btn["run"]) => exec(props.editor, fn);

  const onCsvFileChange = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    console.log("[csv] importing file:", file.name);
    const text = await file.text();
    insertContentOrText(props.editor, csvTextToTableJson(text), text);
    input.value = "";
  };

  return (
    <div class="p-2 flex space-x-1">
      <input ref={(el) => (csvInputRef = el)} type="file" accept=".csv,text/csv" class="hidden" onChange={onCsvFileChange} />

      <div class="flex space-x-1">
        {blocks.map((b) => (
          <Control
            name={b.name}
            class={b.class}
            editor={props.editor}
            onChange={() => run(b.run)}
            title={b.title}
            isActive={b.isActive}
          >
            <span class="w-full h-full m-1">{b.label}</span>
          </Control>
        ))}
      </div>

      <Separator />

      <div class="flex space-x-1">
        {marks.map((b) => (
          <Control name={b.name} class={b.class} editor={props.editor} onChange={() => run(b.run)} title={b.title}>
            {b.label}
          </Control>
        ))}
      </div>

      <Separator />

      <div class="flex space-x-1">
        {listsBlocks.map((b) => (
          <Control name={b.name} class={b.class} editor={props.editor} onChange={() => run(b.run)} title={b.title}>
            {b.label}
          </Control>
        ))}
      </div>

      <Separator />

      <div class="flex space-x-1">
        <Control
          name="table"
          editor={props.editor}
          title="Insert Table"
          onChange={() =>
            run((ch) => {
              // TODO:AS_ANY, table chain commands come from table extension
              (ch as unknown as any).insertTable({ rows: 3, cols: 3, withHeaderRow: true });
              return ch;
            })
          }
        >
          Tbl
        </Control>
        <Control name="table" editor={props.editor} title="Import CSV as Table" onChange={() => csvInputRef?.click()}>
          CSV
        </Control>
        <Control
          name="table"
          editor={props.editor}
          title="Add Row"
          onChange={() =>
            run((ch) => {
              // TODO:AS_ANY, table chain commands come from table extension
              (ch as unknown as any).addRowAfter();
              return ch;
            })
          }
        >
          +R
        </Control>
        <Control
          name="table"
          editor={props.editor}
          title="Add Column"
          onChange={() =>
            run((ch) => {
              // TODO:AS_ANY, table chain commands come from table extension
              (ch as unknown as any).addColumnAfter();
              return ch;
            })
          }
        >
          +C
        </Control>
        <Control
          name="table"
          editor={props.editor}
          title="Delete Row"
          onChange={() =>
            run((ch) => {
              // TODO:AS_ANY, table chain commands come from table extension
              (ch as unknown as any).deleteRow();
              return ch;
            })
          }
        >
          -R
        </Control>
        <Control
          name="table"
          editor={props.editor}
          title="Delete Column"
          onChange={() =>
            run((ch) => {
              // TODO:AS_ANY, table chain commands come from table extension
              (ch as unknown as any).deleteColumn();
              return ch;
            })
          }
        >
          -C
        </Control>
        <Control
          name="table"
          editor={props.editor}
          title="Delete Table"
          onChange={() =>
            run((ch) => {
              // TODO:AS_ANY, table chain commands come from table extension
              (ch as unknown as any).deleteTable();
              return ch;
            })
          }
        >
          ×Tbl
        </Control>
      </div>
    </div>
  );
}


