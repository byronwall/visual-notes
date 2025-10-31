import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Code from "@tiptap/extension-code";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { createLowlight, common } from "lowlight";
import "highlight.js/styles/github.css";
import { Show, createEffect, createMemo, createSignal } from "solid-js";
import { createEditorTransaction, createTiptapEditor } from "solid-tiptap";

function Separator() {
  return (
    <div class="flex items-center" aria-hidden="true">
      <div class="h-full border-l border-gray-300" />
    </div>
  );
}

type ToggleProps = {
  title?: string;
  class?: string;
  pressed?: boolean;
  onChange?: () => void;
  children: any;
};

function Toggle(props: ToggleProps) {
  return (
    <button
      type="button"
      title={props.title}
      class={`w-6 h-6 flex items-center justify-center rounded focus:outline-none focus-visible:ring focus-visible:ring-purple-400 focus-visible:ring-opacity-75 ${
        props.class || ""
      } ${props.pressed ? "bg-white/25" : ""}`}
      onClick={props.onChange}
    >
      {props.children}
    </button>
  );
}

function Control(props: {
  class?: string;
  editor: Editor;
  title: string;
  name: string;
  onChange: () => void;
  isActive?: (editor: Editor) => boolean;
  children: any;
}) {
  const active = createEditorTransaction(
    () => props.editor,
    (instance) =>
      props.isActive ? props.isActive(instance) : instance.isActive(props.name)
  );
  return (
    <Toggle
      title={props.title}
      class={props.class}
      pressed={active()}
      onChange={props.onChange}
    >
      {props.children}
    </Toggle>
  );
}

function ToolbarContents(props: { editor: Editor }) {
  const insertTable = () => {
    try {
      console.log("[tiptap.table] insert 3x3 with header");
    } catch {}
    props.editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  const addRowAfter = () => {
    try {
      console.log("[tiptap.table] addRowAfter");
    } catch {}
    props.editor.chain().focus().addRowAfter().run();
  };

  const addColumnAfter = () => {
    try {
      console.log("[tiptap.table] addColumnAfter");
    } catch {}
    props.editor.chain().focus().addColumnAfter().run();
  };

  const deleteRow = () => {
    try {
      console.log("[tiptap.table] deleteRow");
    } catch {}
    props.editor.chain().focus().deleteRow().run();
  };

  const deleteColumn = () => {
    try {
      console.log("[tiptap.table] deleteColumn");
    } catch {}
    props.editor.chain().focus().deleteColumn().run();
  };

  const deleteTable = () => {
    try {
      console.log("[tiptap.table] deleteTable");
    } catch {}
    props.editor.chain().focus().deleteTable().run();
  };

  return (
    <div class="p-2 flex space-x-1">
      <div class="flex space-x-1">
        <Control
          name="paragraph"
          class="font-bold"
          editor={props.editor}
          onChange={() => props.editor.chain().focus().setParagraph().run()}
          title="Paragraph"
        >
          <span class="w-full h-full m-1">P</span>
        </Control>
        <Control
          name="heading"
          class="font-bold"
          editor={props.editor}
          onChange={() =>
            props.editor.chain().focus().setHeading({ level: 1 }).run()
          }
          isActive={(ed) => ed.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          H1
        </Control>
        <Control
          name="heading"
          class="font-bold"
          editor={props.editor}
          onChange={() =>
            props.editor.chain().focus().setHeading({ level: 2 }).run()
          }
          isActive={(ed) => ed.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          H2
        </Control>
      </div>
      <Separator />
      <div class="flex space-x-1">
        <Control
          name="bold"
          class="font-bold"
          editor={props.editor}
          onChange={() => props.editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          B
        </Control>
        <Control
          name="italic"
          class="italic"
          editor={props.editor}
          onChange={() => props.editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          I
        </Control>
        <Control
          name="strike"
          class="line-through"
          editor={props.editor}
          onChange={() => props.editor.chain().focus().toggleStrike().run()}
          title="Strike Through"
        >
          S
        </Control>
        <Control
          name="code"
          class=""
          editor={props.editor}
          onChange={() => props.editor.chain().focus().toggleCode().run()}
          title="Code"
        >
          {"</>"}
        </Control>
      </div>
      <Separator />
      <div class="flex space-x-1">
        <Control
          name="bulletList"
          class=""
          editor={props.editor}
          onChange={() => props.editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          ••
        </Control>
        <Control
          name="orderedList"
          class=""
          editor={props.editor}
          onChange={() =>
            props.editor.chain().focus().toggleOrderedList().run()
          }
          title="Ordered List"
        >
          1.
        </Control>
        <Control
          name="blockquote"
          class=""
          editor={props.editor}
          onChange={() => props.editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          “
        </Control>
        <Control
          name="codeBlock"
          class=""
          editor={props.editor}
          onChange={() => props.editor.chain().focus().toggleCodeBlock().run()}
          title="Code Block"
        >
          {"{ }"}
        </Control>
      </div>
      <Separator />
      <div class="flex space-x-1">
        <Control
          name="table"
          class=""
          editor={props.editor}
          onChange={insertTable}
          title="Insert Table"
        >
          Tbl
        </Control>
        <Control
          name="table"
          class=""
          editor={props.editor}
          onChange={addRowAfter}
          title="Add Row"
        >
          +R
        </Control>
        <Control
          name="table"
          class=""
          editor={props.editor}
          onChange={addColumnAfter}
          title="Add Column"
        >
          +C
        </Control>
        <Control
          name="table"
          class=""
          editor={props.editor}
          onChange={deleteRow}
          title="Delete Row"
        >
          -R
        </Control>
        <Control
          name="table"
          class=""
          editor={props.editor}
          onChange={deleteColumn}
          title="Delete Column"
        >
          -C
        </Control>
        <Control
          name="table"
          class=""
          editor={props.editor}
          onChange={deleteTable}
          title="Delete Table"
        >
          ×Tbl
        </Control>
      </div>
    </div>
  );
}

const CONTENT = `
<h2>
Hi there,
</h2>
<p>
this is a <em>basic</em> example of <strong>tiptap</strong>.
</p>
`;

export default function TiptapEditor(props: {
  initialHTML?: string;
  class?: string;
  onEditor?: (editor: Editor) => void;
}) {
  const [container, setContainer] = createSignal<HTMLDivElement>();
  const [overlay, setOverlay] = createSignal<{ top: number; left: number }>();

  const languageOptions = createMemo(() => {
    try {
      const keys = Object.keys(common as Record<string, unknown>);
      const base = ["text", "plaintext"];
      const merged = [...base, ...keys.filter((k) => !base.includes(k))];
      return merged.sort((a, b) => a.localeCompare(b));
    } catch {
      return ["text", "plaintext", "javascript", "typescript", "python"];
    }
  });

  // Inline <code> mark with spellcheck disabled
  const CustomCode = Code.extend({
    addAttributes() {
      try {
        console.log("[CustomCode.addAttributes]");
      } catch {}
      // Tiptap's parent attribute typing isn't exported; casting to any preserves base attrs
      const parent = (this as any).parent?.() ?? {};
      return {
        ...parent,
        spellcheck: {
          default: false,
          renderHTML: (attrs: { spellcheck?: boolean }) => ({
            spellcheck: attrs.spellcheck ? "true" : "false",
          }),
        },
      } as any;
    },
  });

  // CodeBlock extension with spellcheck disabled on the <pre>
  const CustomCodeBlock = CodeBlockLowlight.extend({
    addAttributes() {
      try {
        console.log("[CustomCodeBlock.addAttributes]");
      } catch {}
      // Tiptap's parent attribute typing isn't exported; casting to any preserves base attrs
      const parent = (this as any).parent?.() ?? {};
      return {
        ...parent,
        spellcheck: {
          default: false,
          renderHTML: (attrs: { spellcheck?: boolean }) => ({
            spellcheck: attrs.spellcheck ? "true" : "false",
          }),
        },
      } as any;
    },
  }).configure({ lowlight: createLowlight(common) });

  const editor = createTiptapEditor(() => ({
    element: container()!,
    extensions: [
      StarterKit.configure({ codeBlock: false, code: false }),
      Image.configure({ allowBase64: true }),
      CustomCode,
      CustomCodeBlock,
      Table.configure({
        resizable: true,
        lastColumnResizable: true,
        allowTableNodeSelection: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    editorProps: {
      attributes: { class: "p-4 focus:outline-none prose max-w-full" },
    },
    content: props.initialHTML ?? CONTENT,
  }));

  // Expose editor instance to parent when available
  createEffect(() => {
    const ed = editor();
    if (ed && props.onEditor) props.onEditor(ed);
  });

  // Keep editor content in sync when incoming HTML changes (e.g., new doc selection)
  createEffect(() => {
    const ed = editor();
    if (!ed) return;
    const next = props.initialHTML ?? CONTENT;
    try {
      const current = ed.getHTML();

      if (typeof next === "string" && next !== current) {
        ed.commands.setContent(next, { emitUpdate: false });
        try {
          const after = ed.getHTML();
          const hasPre = /<pre\b[^>]*>\s*<code\b/i.test(after);
          const json = ed.getJSON();
          const hasCodeBlockNode = JSON.stringify(json).includes('"codeBlock"');
          const afterImgs = (after.match(/<img\b/gi) || []).length;
          const afterDataImgs = (after.match(/<img[^>]*src=["']data:/gi) || [])
            .length;
          console.log(
            "[tiptap.setContent] after len:%d imgs:%d dataImgs:%d preCode:%s codeBlockNode:%s",
            after.length,
            afterImgs,
            afterDataImgs,
            hasPre,
            hasCodeBlockNode
          );
        } catch {}
      }
    } catch {}
  });

  // Track whether we're inside a code block and position the language picker
  const isInCodeBlock = createEditorTransaction(
    () => editor()!,
    (instance) => instance.isActive("codeBlock")
  );
  const currentLanguage = createEditorTransaction(
    () => editor()!,
    (instance) => instance.getAttributes("codeBlock")?.language || "text"
  );

  function updateOverlayPosition() {
    const ed = editor();
    const host = container();
    if (!ed || !host) return;
    if (!ed.isActive("codeBlock")) {
      setOverlay(undefined);
      return;
    }
    // We need ProseMirror DOM node of the active code block. Types are not exported for this API.
    // Using `any` here to access view/state is acceptable because Tiptap's Editor type hides them.
    const view = (ed as any).view as { nodeDOM: (pos: number) => Node | null };
    const state = (ed as any).state as { selection: any };
    const $from = state.selection.$from;
    let dom: HTMLElement | null = null;
    for (let d = $from.depth; d >= 0; d--) {
      const node = $from.node(d);
      if (node?.type?.name === "codeBlock") {
        const pos = $from.before(d);
        dom = (view.nodeDOM(pos) as HTMLElement) || null;
        break;
      }
    }
    if (!dom) {
      setOverlay(undefined);
      return;
    }
    const pre = dom.matches("pre")
      ? dom
      : (dom.querySelector("pre") as HTMLElement | null);
    const target = pre || dom;
    const block = target.getBoundingClientRect();
    const wrap = host.getBoundingClientRect();
    const top = block.top - wrap.top + host.scrollTop - 8; // nudge above block
    const left = block.left - wrap.left + host.scrollLeft + 8; // nudge to left padding
    try {
      console.log("[tiptap.codeBlock] overlay pos:", { top, left });
    } catch {}
    setOverlay({ top, left });
  }

  createEffect(() => {
    const ed = editor();
    if (!ed) return;
    const handler = () => updateOverlayPosition();
    ed.on("selectionUpdate", handler);
    ed.on("transaction", handler);
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    handler();
    return () => {
      ed.off("selectionUpdate", handler);
      ed.off("transaction", handler);
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  });

  return (
    <div class={props.class || "w-full"}>
      <div class="mb-2 rounded bg-gray-50 text-gray-800 border border-gray-300">
        <Show when={editor()} keyed>
          {(instance) => <ToolbarContents editor={instance} />}
        </Show>
      </div>
      <div class="relative rounded border border-gray-300">
        <div class="min-h-[200px]" ref={setContainer} />
        <Show when={editor() && isInCodeBlock() && overlay()}>
          <div
            class="absolute z-10"
            style={{ top: `${overlay()!.top}px`, left: `${overlay()!.left}px` }}
          >
            <div class="flex items-center gap-1 bg-white/95 border border-gray-300 rounded px-2 py-[2px] shadow-sm">
              <select
                class="text-xs bg-transparent"
                value={currentLanguage()}
                onInput={(e) => {
                  const lang = (e.currentTarget as HTMLSelectElement).value;
                  try {
                    console.log("[tiptap.codeBlock] set language=", lang);
                  } catch {}
                  editor()
                    ?.chain()
                    .focus()
                    .updateAttributes("codeBlock", { language: lang })
                    .run();
                }}
              >
                {languageOptions().map((l) => (
                  <option value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
