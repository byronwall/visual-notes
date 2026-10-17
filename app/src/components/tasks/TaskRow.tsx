import { ChevronRightIcon } from "lucide-solid";
import { createEffect, createMemo, Show } from "solid-js";
import { css } from "styled-system/css";
import type { TaskItem } from "~/services/tasks/tasks.service";
import { TaskMarkdownPreview } from "./TaskMarkdownPreview";
import { TaskRowMenu } from "./TaskRowMenu";
import { TaskRowMeta } from "./TaskRowMeta";
import { STATUS_META, TaskStatusIcon, statusColorClass } from "./TaskStatusIcon";
import { isDoneStatus } from "./taskFormat";
import { handleMoveKey, handleRowKeyDown } from "./taskRowKeys";
import { useTaskTree, type DropKind } from "./TaskTreeContext";

type Props = {
  task: TaskItem;
  hasChildren: boolean;
  childProgress: { done: number; total: number };
};

export const rowClass = css({
  position: "relative",
  display: "flex",
  alignItems: "flex-start",
  gap: "1",
  pl: "1",
  pr: "1",
  py: "1",
  borderRadius: "l2",
  minH: "8",
  outline: "none",
  transitionProperty: "background-color, opacity",
  transitionDuration: "fast",
  _hover: { bg: "gray.a2" },
  "&[data-selected=true]": { bg: "gray.a3" },
  _focusVisible: { boxShadow: "inset 0 0 0 1px token(colors.gray.a8)" },
  "&[data-dragging=true]": { opacity: 0.4 },
  "&[data-drop=inside]": {
    bg: "gray.a3",
    boxShadow: "inset 0 0 0 1px token(colors.gray.a9)",
  },
  "&[data-drop=before]": { boxShadow: "inset 0 2px 0 0 token(colors.gray.11)" },
  "&[data-drop=after]": { boxShadow: "inset 0 -2px 0 0 token(colors.gray.11)" },
  "& [data-reveal]": {
    opacity: 0,
    transitionProperty: "opacity",
    transitionDuration: "fast",
  },
  "&:hover [data-reveal], &[data-selected=true] [data-reveal], & [data-reveal]:focus-visible, & [data-reveal][data-state=open]":
    { opacity: 1 },
  "@media (hover: none)": { "& [data-reveal]": { opacity: 1 } },
});

const iconButtonClass = css({
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "6",
  h: "6",
  borderRadius: "l2",
  cursor: "pointer",
  transitionProperty: "background-color, color, transform",
  transitionDuration: "fast",
  _hover: { bg: "gray.a3" },
  _active: { transform: "scale(0.9)" },
  _disabled: { cursor: "default", bg: "transparent", transform: "none" },
  _focusVisible: { outline: "2px solid token(colors.gray.a8)", outlineOffset: "-2px" },
  "@media (prefers-reduced-motion: reduce)": { _active: { transform: "none" } },
});

const chevronClass = css({
  color: "fg.subtle",
  "& svg": { transitionProperty: "transform", transitionDuration: "fast" },
  "&[data-expanded=true] svg": { transform: "rotate(90deg)" },
});

const titleClass = css({
  flex: "1 1 16rem",
  minW: "0",
  py: "0.5",
  fontSize: "sm",
  lineHeight: "1.25rem",
  color: "fg.default",
  cursor: "text",
  overflowWrap: "anywhere",
  "& p": { m: "0" },
  "&[data-done=true]": { color: "fg.muted" },
  "&[data-status=cancelled]": { textDecoration: "line-through" },
});

const inlineInputClass = css({
  appearance: "none",
  bg: "transparent",
  borderWidth: "0",
  color: "fg.default",
  flex: "1 1 16rem",
  minW: "0",
  py: "0.5",
  fontSize: "sm",
  lineHeight: "1.25rem",
  outline: "none",
  _placeholder: { color: "fg.subtle" },
});

const dropKindFromPointer = (event: DragEvent, element: HTMLElement): DropKind => {
  const rect = element.getBoundingClientRect();
  const offset = (event.clientY - rect.top) / Math.max(rect.height, 1);
  if (offset < 0.3) return "before";
  if (offset > 0.7) return "after";
  return "inside";
};

export const TaskRow = (props: Props) => {
  const ctx = useTaskTree();
  let inlineInputRef: HTMLInputElement | undefined;
  let rowRef: HTMLDivElement | undefined;

  const edit = createMemo(() => {
    const state = ctx.inlineEdit();
    return state?.taskId === props.task.id ? state : null;
  });
  const isEditing = () => edit() !== null;
  const isActive = () => ctx.activeTaskId() === props.task.id;
  const expanded = () => ctx.expandedIds().has(props.task.id);
  const done = () => isDoneStatus(props.task.status);
  const dropKind = () => {
    const drop = ctx.activeDrop();
    return drop?.taskId === props.task.id ? drop.kind : undefined;
  };

  createEffect((wasEditing: boolean) => {
    const editing = isEditing();
    if (editing && !wasEditing) {
      queueMicrotask(() => {
        inlineInputRef?.focus();
        inlineInputRef?.setSelectionRange(0, props.task.description.length);
      });
    }
    return editing;
  }, false);

  createEffect(() => {
    if (ctx.focusTaskId() !== props.task.id || !rowRef) return;
    queueMicrotask(() => {
      rowRef?.focus({ preventScroll: false });
      rowRef?.scrollIntoView({ block: "nearest" });
      ctx.focusSettled(props.task.id);
    });
  });

  const readDraggedId = (event: DragEvent) =>
    event.dataTransfer?.getData("text/plain")?.trim() || null;

  return (
    <div
      ref={rowRef}
      class={rowClass}
      role="treeitem"
      aria-selected={isActive()}
      aria-expanded={props.hasChildren ? expanded() : undefined}
      data-testid={`task-row-${props.task.id}`}
      data-selected={isActive() ? "true" : "false"}
      data-dragging={ctx.draggingTaskId() === props.task.id ? "true" : undefined}
      data-drop={dropKind() ?? "none"}
      tabIndex={isActive() ? 0 : -1}
      draggable={!isEditing()}
      onFocus={() => ctx.activate(props.task.id)}
      onClick={() => ctx.activate(props.task.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        handleRowKeyDown(event, props.task, ctx);
      }}
      onDragStart={(event) => {
        event.dataTransfer?.setData("text/plain", props.task.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        ctx.dragStart(props.task.id);
      }}
      onDragEnd={() => ctx.dragEnd()}
      onDragOver={(event) => {
        if (!ctx.draggingTaskId() || ctx.draggingTaskId() === props.task.id) return;
        event.preventDefault();
        ctx.dragOver(props.task.id, dropKindFromPointer(event, event.currentTarget));
      }}
      onDrop={(event) => {
        event.preventDefault();
        ctx.drop(
          props.task.id,
          dropKindFromPointer(event, event.currentTarget),
          readDraggedId(event)
        );
      }}
    >
      <button
        type="button"
        class={`${iconButtonClass} ${chevronClass}`}
        data-expanded={expanded() ? "true" : "false"}
        data-testid={`task-toggle-${props.task.id}`}
        tabIndex={-1}
        disabled={!props.hasChildren}
        aria-label={expanded() ? "Collapse subtasks" : "Expand subtasks"}
        onClick={(event) => {
          event.stopPropagation();
          if (props.hasChildren) ctx.toggleExpanded(props.task.id);
        }}
      >
        <Show when={props.hasChildren}>
          <ChevronRightIcon size={14} />
        </Show>
      </button>

      <button
        type="button"
        class={`${iconButtonClass} ${statusColorClass}`}
        data-status={props.task.status}
        data-testid={`task-status-${props.task.id}`}
        tabIndex={-1}
        aria-label={
          props.task.status === "complete"
            ? `Mark "${props.task.description}" not done`
            : `Mark "${props.task.description}" done`
        }
        title={STATUS_META[props.task.status].label}
        onClick={(event) => {
          event.stopPropagation();
          ctx.activate(props.task.id);
          ctx.toggleStatus(props.task, "complete");
        }}
      >
        <TaskStatusIcon status={props.task.status} />
      </button>

      <div
        class={css({
          flex: "1",
          minW: "0",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          columnGap: "3",
          rowGap: "0",
        })}
      >
        <Show
          when={edit()}
          fallback={
            <TaskMarkdownPreview
              class={titleClass}
              data-done={done() ? "true" : "false"}
              data-status={props.task.status}
              markdown={props.task.description}
              onClick={() => {
                ctx.activate(props.task.id);
                ctx.openInlineEdit(props.task);
              }}
            />
          }
        >
          {(state) => (
            <input
              ref={inlineInputRef}
              class={inlineInputClass}
              value={state().value}
              disabled={state().saving}
              aria-label="Task title"
              placeholder="Task title  #tag  @fri  ~30m"
              data-testid={`task-inline-input-${props.task.id}`}
              onClick={(event) => event.stopPropagation()}
              onInput={(event) => ctx.inlineEditChange(event.currentTarget.value)}
              onBlur={() => {
                // Read the memo, not the Show accessor: blur also fires on unmount.
                if (edit() && !edit()!.saving) ctx.inlineEditSubmit();
              }}
              onKeyDown={(event) => {
                if (handleMoveKey(event, props.task, ctx)) return;
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  ctx.inlineEditSubmit();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  ctx.inlineEditCancel();
                }
              }}
            />
          )}
        </Show>

        <TaskRowMeta
          task={props.task}
          todayKey={ctx.todayKey()}
          childProgress={props.childProgress}
          error={edit()?.error ?? null}
        />
      </div>

      <TaskRowMenu
        class={css({ flexShrink: 0, mt: "0.5" })}
        taskLabel={props.task.description}
        status={props.task.status}
        onStatus={(status) => ctx.setStatus(props.task, status)}
        onEditDetails={() => ctx.openDetails(props.task)}
        onAddSubtask={() => ctx.addSubtask(props.task)}
        onDelete={() => ctx.deleteTask(props.task)}
      />
    </div>
  );
};
