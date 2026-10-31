import { useAction } from "@solidjs/router";
import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { css } from "styled-system/css";
import {
  createTaskList,
  deleteTaskList,
  updateTaskList,
  type TaskItem,
} from "~/services/tasks/tasks.service";
import { createTaskActions } from "./createTaskActions";
import { createTaskData } from "./createTaskData";
import { TaskEditorDialog } from "./TaskEditorDialog";
import { TaskEmptyState } from "./TaskEmptyState";
import { TaskListHeader } from "./TaskListHeader";
import { TaskListNameInput } from "./TaskListNameInput";
import { TaskListSelector } from "./TaskListSelector";
import { TaskQuickAdd } from "./TaskQuickAdd";
import { TaskTree } from "./TaskTree";
import { TaskTreeProvider } from "./TaskTreeContext";
import { summarizeTasks } from "./taskFormat";
import { handleRowKeyDown } from "./taskRowKeys";
import { isDescendantOf } from "./taskTreeOps";

const isTextEntryTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const isInsideOverlay = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest('[role="menu"], [role="dialog"], [role="listbox"]');

const sectionLabelClass = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  h: "8",
  mt: "3",
  pl: "2",
  fontSize: "xs",
  fontWeight: "medium",
  color: "fg.subtle",
  textTransform: "uppercase",
  letterSpacing: "wider",
});

export const TaskListsWorkspace = () => {
  const data = createTaskData();
  const runCreateList = useAction(createTaskList);
  const runUpdateList = useAction(updateTaskList);
  const runDeleteList = useAction(deleteTaskList);

  const [editingTask, setEditingTask] = createSignal<TaskItem | null>(null);
  const [rootDropActive, setRootDropActive] = createSignal(false);
  let quickAddRef: HTMLTextAreaElement | undefined;

  const actions = createTaskActions(data, {
    focusQuickAdd: () => quickAddRef?.focus(),
    openDetails: (task) => setEditingTask(task),
  });

  const summary = createMemo(() =>
    summarizeTasks(data.taskItems(), actions.context.todayKey()),
  );
  const activeRootIds = createMemo(() => data.visibleChildIds(null));

  const selectList = (listId: string) => {
    actions.resetForListChange();
    data.selectList(listId);
  };

  const createList = async (name: string) => {
    const created = await runCreateList({ name });
    data.refreshLists();
    if (created?.id) selectList(created.id);
  };

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTextEntryTarget(event.target)) return;
      if (isInsideOverlay(event.target) || editingTask()) return;
      if (
        event.key.toLowerCase() === "n" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        if (!data.selectedListId()) return;
        event.preventDefault();
        actions.startInlineCreate();
        return;
      }
      // Row shortcuts also work when focus sits on a row's buttons or the page.
      const active = actions.activeTaskId();
      const task = active ? data.tasksById().get(active) : undefined;
      if (task) {
        handleRowKeyDown(event, task, actions.context);
      } else if (event.key === "ArrowDown" && !event.altKey) {
        event.preventDefault();
        actions.selectFirst();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return (
    <div
      data-testid="tasks-page"
      class={css({
        display: "grid",
        gridTemplateColumns: {
          base: "minmax(0, 1fr)",
          lg: "13rem minmax(0, 1fr)",
        },
        gridTemplateRows: { base: "auto minmax(0, 1fr)", lg: "minmax(0, 1fr)" },
        columnGap: "8",
        rowGap: { base: "0.5", lg: "3" },
        flex: "1",
        minH: "0",
      })}
    >
      <TaskListSelector
        lists={data.mergedLists()}
        selectedListId={data.selectedListId()}
        selectedOpenCount={
          data.selectedListId() && data.tasks.latest ? summary().open : null
        }
        onSelect={selectList}
        onCreate={createList}
        onRename={(list, name) => {
          data.mutateLists((current) =>
            current?.map((item) =>
              item.id === list.id ? { ...item, name } : item,
            ),
          );
          runUpdateList({ id: list.id, name })
            .catch((err) => console.error("[tasks] list rename failed", err))
            .finally(() => data.refreshLists());
        }}
        onDelete={async (list) => {
          await runDeleteList({ id: list.id });
          data.refreshLists();
        }}
      />

      <main
        class={css({
          display: "flex",
          flexDirection: "column",
          minH: "0",
          minW: "0",
          maxW: "56rem",
        })}
      >
        <Show
          when={data.selectedList()}
          fallback={
            <Show when={data.lists.latest}>
              <TaskEmptyState title="No task lists yet">
                <div class={css({ w: "16rem" })}>
                  <TaskListNameInput
                    initialValue=""
                    placeholder="Name your first list"
                    ariaLabel="New list name"
                    onCommit={(name) => name && void createList(name)}
                    onCancel={() => undefined}
                  />
                </div>
              </TaskEmptyState>
            </Show>
          }
        >
          {(list) => (
            <TaskTreeProvider value={actions.context}>
              <TaskListHeader
                title={list().name.trim() || "Untitled list"}
                summary={summary()}
                error={actions.error()}
                showDone={data.showDone()}
                doneCount={data.hiddenDoneCount()}
                onToggleDone={() => data.setShowDone(!data.showDone())}
              />

              <TaskQuickAdd
                ref={(element) => (quickAddRef = element)}
                todayKey={actions.context.todayKey()}
                onSubmit={actions.quickAdd}
              />

              <div
                class={css({
                  flex: "1",
                  minH: "0",
                  overflowY: "auto",
                  mt: "2",
                  mx: "-1",
                  px: "1",
                  pb: "6",
                })}
              >
                <TaskTree
                  rootIds={activeRootIds()}
                  label={`${list().name} tasks`}
                  hostsDraft
                  testId="task-tree-active"
                />

                <Show when={data.tasks.latest && data.taskItems().length === 0}>
                  <TaskEmptyState title="No tasks yet" compact />
                </Show>

                <Show
                  when={
                    data.tasks.latest &&
                    data.taskItems().length > 0 &&
                    activeRootIds().length === 0 &&
                    !actions.inlineCreate()
                  }
                >
                  <TaskEmptyState title="All caught up" compact>
                    {summary().done} done in this list.
                  </TaskEmptyState>
                </Show>

                <Show when={actions.draggingTaskId()}>
                  <div
                    data-testid="task-drop-root"
                    data-active={rootDropActive() ? "true" : "false"}
                    class={css({
                      mt: "1",
                      h: "8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "l2",
                      borderWidth: "1px",
                      borderStyle: "dashed",
                      borderColor: "border",
                      fontSize: "xs",
                      color: "fg.subtle",
                      transitionProperty: "background-color, color",
                      transitionDuration: "fast",
                      "&[data-active=true]": {
                        bg: "bg.selected",
                        color: "fg.default",
                      },
                    })}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setRootDropActive(true);
                      actions.setDropToRoot();
                    }}
                    onDragLeave={() => setRootDropActive(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setRootDropActive(false);
                      actions.dropToRoot(
                        event.dataTransfer?.getData("text/plain")?.trim() ||
                          null,
                      );
                    }}
                  >
                    Move to top level
                  </div>
                </Show>

                <Show when={data.showDone() && data.doneRootIds().length > 0}>
                  <div class={sectionLabelClass}>Done</div>
                  <TaskTree
                    rootIds={data.doneRootIds()}
                    label="Done tasks"
                    testId="task-tree-done"
                  />
                </Show>
              </div>
            </TaskTreeProvider>
          )}
        </Show>
      </main>

      <TaskEditorDialog
        open={!!editingTask()}
        mode="edit"
        task={editingTask()}
        parentTaskId={editingTask()?.parentTaskId ?? null}
        parentOptions={data
          .taskItems()
          .filter((task) => {
            const editing = editingTask();
            // A task cannot move under itself or its own subtasks.
            return (
              !editing ||
              (task.id !== editing.id &&
                !isDescendantOf(data.tasksById(), task.id, editing.id))
            );
          })
          .map((task) => ({
            id: task.id,
            label: task.description.slice(0, 80),
          }))}
        onClose={() => {
          const task = editingTask();
          setEditingTask(null);
          if (task) actions.select(task.id);
        }}
        onSubmit={async (value) => {
          const task = editingTask();
          if (!task) return;
          const { parentTaskId, ...fields } = value;
          actions.patchTask(task.id, fields);
          await actions.runUpdateTask({ id: task.id, ...fields });
          if (parentTaskId !== task.parentTaskId) {
            const siblings = data.children().get(parentTaskId) ?? [];
            await actions.runMoveTask({
              taskId: task.id,
              targetParentTaskId: parentTaskId,
              targetIndex: siblings.length,
            });
          }
          data.refreshTasks();
          data.refreshLists();
        }}
        onDelete={async () => {
          const task = editingTask();
          if (task) actions.context.deleteTask(task);
        }}
      />
    </div>
  );
};
