import { InputRule } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { createMemo } from "solid-js";
import { css } from "styled-system/css";
import { DONE_STATUSES, TaskRef } from "~/lib/note-content/task-ref";
import {
  createInlineTask,
  setInlineTaskDone,
} from "~/services/tasks/inline-tasks.actions";
import {
  createSolidNodeViewRenderer,
  NodeViewContent,
  NodeViewWrapper,
  useSolidNodeView,
} from "../nodeviews";

type TaskAttrs = { id: string | null; taskId: string | null; status: string };

const rowClass = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "2",
  my: "1",
});
const checkboxClass = css({
  mt: "0.35em",
  w: "4",
  h: "4",
  flexShrink: "0",
  cursor: "pointer",
  accentColor: "var(--colors-blue-9)",
});
const textClass = css({
  flex: "1",
  minW: "0",
  "&[data-done=true]": { color: "fg.muted", textDecorationLine: "line-through" },
});

function TaskRefNodeView() {
  const { state } = useSolidNodeView<TaskAttrs>();
  const attrs = () => state().node.attrs;
  const done = createMemo(() => DONE_STATUSES.has(attrs().status));

  // Update this node by position: the renderer's updateAttributes targets
  // the node at the selection, which is a different line when clicking.
  const setStatus = (status: string) => {
    const { editor, getPos } = state();
    const pos = getPos();
    if (typeof pos !== "number" || editor.isDestroyed) return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, status }),
    );
  };

  const toggle = async () => {
    const next = !done();
    const previous = attrs().status;
    setStatus(next ? "complete" : "waiting");
    const taskId = attrs().taskId;
    if (!taskId) return;
    try {
      await setInlineTaskDone({ taskId, done: next });
    } catch (e) {
      console.warn("[inline-tasks] status update failed", e);
      setStatus(previous);
    }
  };

  return (
    <NodeViewWrapper
      class={rowClass}
      data-id={attrs().id ?? undefined}
      data-task-ref=""
    >
      <input
        type="checkbox"
        contentEditable={false}
        class={checkboxClass}
        checked={done()}
        aria-label={done() ? "Mark task not done" : "Mark task done"}
        title={attrs().taskId ? "Task in Inbox" : "Creating task…"}
        data-task-action="true"
        onMouseDown={(e) => e.preventDefault()}
        onChange={() => void toggle()}
      />
      <NodeViewContent as="div" class={textClass} data-done={done()} />
    </NodeViewWrapper>
  );
}

const docIdFromLocation = () =>
  /^\/docs\/([^/]+)/.exec(window.location.pathname)?.[1] ?? null;

/**
 * Editor version of the task line: a live checkbox, `[] ` / `[x] ` at the
 * start of a line to make one, Enter for the next task, and a background
 * step that creates the TaskItem once the line has text.
 */
export const TaskRefEditor = TaskRef.extend({
  addAttributes() {
    // TODO:AS_ANY, extend base attrs; parent() is not well-typed in Tiptap's API
    const parent = (this as any).parent?.() ?? {};
    return {
      ...parent,
      taskId: { ...parent.taskId, keepOnSplit: false },
      status: { ...parent.status, keepOnSplit: false },
    } as any;
  },

  addNodeView() {
    return createSolidNodeViewRenderer(TaskRefNodeView, {
      stopEvent: ({ event }) =>
        !!(event.target as HTMLElement | null)?.closest("[data-task-action='true']"),
    });
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^\s*\[( |x|X)?\]\s$/,
        handler: ({ state, range, match }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.name !== "paragraph") return null;
          const done = (match[1] ?? "").toLowerCase() === "x";
          state.tr
            .delete(range.from, range.to)
            .setBlockType(range.from, range.from, this.type, {
              status: done ? "complete" : "waiting",
            });
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    const isEmptyTask = () => {
      const { $from, empty } = this.editor.state.selection;
      return (
        empty &&
        $from.parent.type.name === this.name &&
        $from.parent.content.size === 0
      );
    };
    return {
      // Enter continues with a new task; on an empty task line it ends them.
      Enter: () => {
        const { $from } = this.editor.state.selection;
        if ($from.parent.type.name !== this.name) return false;
        if (isEmptyTask()) return this.editor.commands.setParagraph();
        return this.editor
          .chain()
          .splitBlock()
          .setNode(this.name, { taskId: null, status: "waiting" })
          .run();
      },
      Backspace: () => {
        const { $from, empty } = this.editor.state.selection;
        if (!empty || $from.parent.type.name !== this.name) return false;
        if ($from.parentOffset !== 0) return false;
        return this.editor.commands.setParagraph();
      },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const typeName = this.name;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const createMissing = () => {
      if (editor.isDestroyed) return;
      editor.state.doc.descendants((node) => {
        if (node.type.name !== typeName || node.attrs.taskId) return;
        const blockId = node.attrs.id as string | null;
        const text = node.textContent.trim();
        if (!blockId || !text || pending.has(blockId)) return;
        pending.add(blockId);
        void createInlineTask({ description: text, docId: docIdFromLocation() })
          .then((task) => {
            if (editor.isDestroyed) return;
            const { state } = editor.view;
            state.doc.descendants((n, pos) => {
              if (n.type.name === typeName && n.attrs.id === blockId && !n.attrs.taskId) {
                editor.view.dispatch(
                  state.tr.setNodeMarkup(pos, undefined, { ...n.attrs, taskId: task.id }),
                );
                return false;
              }
            });
          })
          .catch((e) => console.warn("[inline-tasks] create failed", e))
          .finally(() => pending.delete(blockId));
      });
    };

    return [
      new Plugin({
        key: new PluginKey("taskRefCreate"),
        view: () => ({
          update: (view, prev) => {
            if (view.state.doc.eq(prev.doc)) return;
            clearTimeout(timer);
            timer = setTimeout(createMissing, 700);
          },
          destroy: () => clearTimeout(timer),
        }),
      }),
    ];
  },
});
