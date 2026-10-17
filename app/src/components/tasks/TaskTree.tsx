import { For, Show, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { TaskDraftRow } from "./TaskDraftRow";
import { TaskRow } from "./TaskRow";
import { useTaskTree } from "./TaskTreeContext";

type Props = {
  rootIds: string[];
  label: string;
  /** Only the active tree hosts the inline-create draft row. */
  hostsDraft?: boolean;
  testId?: string;
};

const groupClass = css({
  display: "flex",
  flexDirection: "column",
  // The subtask guide line sits under the parent's chevron.
  ml: "4",
  pl: "1",
  borderLeftWidth: "1px",
  borderLeftColor: "border",
});

export const TaskTree = (props: Props) => {
  const ctx = useTaskTree();

  const draftAt = (
    parentTaskId: string | null,
    afterTaskId: string | null,
  ): JSX.Element => (
    <Show
      when={(() => {
        if (!props.hostsDraft) return null;
        const draft = ctx.inlineCreate();
        return draft &&
          draft.parentTaskId === parentTaskId &&
          draft.afterTaskId === afterTaskId
          ? draft
          : null;
      })()}
    >
      {(_draft) => (
        // Read the signal, not the Show accessor: the input's blur handler runs
        // while this row unmounts, when the accessor is already stale.
        <TaskDraftRow
          value={ctx.inlineCreate()?.value ?? ""}
          saving={ctx.inlineCreate()?.saving ?? false}
          error={ctx.inlineCreate()?.error ?? null}
          onChange={ctx.inlineCreateChange}
          onSubmit={ctx.inlineCreateSubmit}
          onCancel={ctx.inlineCreateCancel}
        />
      )}
    </Show>
  );

  const renderIds = (
    ids: string[],
    parentTaskId: string | null,
  ): JSX.Element => (
    <>
      {draftAt(parentTaskId, null)}
      <For each={ids}>
        {(taskId) => {
          const childIds = () => ctx.childIds(taskId);
          const expanded = () => ctx.expandedIds().has(taskId);
          const draftInside = () =>
            !!props.hostsDraft && ctx.inlineCreate()?.parentTaskId === taskId;
          return (
            <Show when={ctx.task(taskId)}>
              {(task) => (
                <>
                  <TaskRow
                    task={task()}
                    hasChildren={childIds().length > 0}
                    childProgress={ctx.progress(taskId)}
                  />
                  <Show
                    when={
                      (childIds().length > 0 && expanded()) || draftInside()
                    }
                  >
                    <div
                      class={groupClass}
                      role="group"
                      data-testid={`task-children-${taskId}`}
                    >
                      {renderIds(childIds(), taskId)}
                    </div>
                  </Show>
                  {draftAt(parentTaskId, taskId)}
                </>
              )}
            </Show>
          );
        }}
      </For>
    </>
  );

  return (
    <div role="tree" aria-label={props.label} data-testid={props.testId}>
      {renderIds(props.rootIds, null)}
    </div>
  );
};
