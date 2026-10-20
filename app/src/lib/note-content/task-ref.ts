import { Node, mergeAttributes } from "@tiptap/core";

export type TaskRefAttrs = {
  id: string | null;
  /** TaskItem id; null until the task has been created. */
  taskId: string | null;
  /** Display cache of the TaskItem status, refreshed on every read. */
  status: string;
};

export const DONE_STATUSES = new Set(["complete", "cancelled"]);

/**
 * A checkbox line that is a real TaskItem. The text is the task's
 * description (edited in place); the checkbox reflects and changes the
 * task's status. The TaskItem is the source of truth for status.
 */
export const TaskRef = Node.create({
  name: "taskRef",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      taskId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-task-id"),
        renderHTML: (attrs: TaskRefAttrs) =>
          attrs.taskId ? { "data-task-id": attrs.taskId } : {},
      },
      status: {
        default: "waiting",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-status") ?? "waiting",
        renderHTML: (attrs: TaskRefAttrs) => ({ "data-status": attrs.status }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-task-ref]", contentElement: "span[data-task-text]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const done = DONE_STATUSES.has(String(node.attrs.status));
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-task-ref": "", class: "task-ref" }),
      [
        "input",
        {
          type: "checkbox",
          disabled: "disabled",
          ...(done ? { checked: "checked" } : {}),
        },
      ],
      ["span", { "data-task-text": "" }, 0],
    ];
  },
});
