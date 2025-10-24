import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Show, createEffect, createSignal } from "solid-js";
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

export default function TiptapExample(props: {
  initialHTML?: string;
  class?: string;
  onEditor?: (editor: Editor) => void;
}) {
  const [container, setContainer] = createSignal<HTMLDivElement>();

  const editor = createTiptapEditor(() => ({
    element: container()!,
    extensions: [StarterKit, Image.configure({ allowBase64: true })],
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
          const afterImgs = (after.match(/<img\b/gi) || []).length;
          const afterDataImgs = (after.match(/<img[^>]*src=["']data:/gi) || [])
            .length;
          console.log(
            "[tiptap.setContent] after len:%d imgs:%d dataImgs:%d",
            after.length,
            afterImgs,
            afterDataImgs
          );
        } catch {}
      }
    } catch {}
  });

  return (
    <div class={props.class || "w-full"}>
      <div class="mb-2 rounded bg-gray-800 text-white">
        <Show when={editor()} keyed>
          {(instance) => <ToolbarContents editor={instance} />}
        </Show>
      </div>
      <div class="rounded border border-gray-300">
        <div class="min-h-[200px]" ref={setContainer} />
      </div>
    </div>
  );
}
