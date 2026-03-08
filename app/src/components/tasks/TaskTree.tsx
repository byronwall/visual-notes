import { createMemo, For, Show } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import type { TaskItem } from "~/services/tasks/tasks.service";
import { TaskDraftRow } from "./TaskDraftRow";
import { TaskRow } from "./TaskRow";
import type { TaskTreeNode } from "./tree";

type DropKind = "before" | "inside" | "after";
type MoveDirection = "up" | "down" | "left" | "right";

type DropTarget = {
  taskId: string;
  kind: DropKind;
};

type InlineCreateState = {
  parentTaskId: string | null;
  targetIndex: number;
  value: string;
  saving: boolean;
  error: string | null;
};

type Props = {
  nodes: TaskTreeNode[];
  expandedIds: Set<string>;
  activeTaskId: string | null;
  focusTaskId: string | null;
  draggingTaskId: string | null;
  activeDrop: DropTarget | null;
  inlineEditTaskId: string | null;
  inlineEditValue: string;
  inlineEditSaving: boolean;
  inlineEditError: string | null;
  inlineCreate: InlineCreateState | null;
  onToggleExpanded: (taskId: string) => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDrop: (
    targetTaskId: string,
    kind: DropKind,
    draggedTaskId: string | null
  ) => void;
  onDragEnterTarget: (targetTaskId: string, kind: DropKind) => void;
  onActivate: (taskId: string) => void;
  onClearSelection: () => void;
  onFocusSettled: (taskId: string) => void;
  onSelectAdjacent: (taskId: string, direction: "up" | "down") => void;
  onNavigateTree: (taskId: string, direction: "left" | "right") => void;
  onOpenInlineEdit: (task: TaskItem) => void;
  onOpenDetails: (task: TaskItem) => void;
  onInlineEditChange: (value: string) => void;
  onInlineEditSubmit: () => void;
  onInlineEditCancel: () => void;
  onInlineCreateChange: (value: string) => void;
  onInlineCreateSubmit: () => void;
  onInlineCreateCancel: () => void;
  onMoveByKeyboard: (taskId: string, direction: MoveDirection) => void;
  onDropRoot: (draggedTaskId: string | null) => void;
  onDragEnterRoot: () => void;
};

export const TaskTree = (props: Props) => {
  const hasRows = createMemo(
    () => props.nodes.length > 0 || props.inlineCreate?.parentTaskId === null
  );
  const firstRootTaskId = createMemo(() => props.nodes[0]?.task.id ?? null);
  const topRootDropActive = createMemo(
    () => props.activeDrop?.taskId === firstRootTaskId() && props.activeDrop.kind === "before"
  );

  const renderInlineCreateRow = (parentTaskId: string | null, index: number, depth: number) => {
    const draft = props.inlineCreate;
    if (!draft) return null;
    if (draft.parentTaskId !== parentTaskId || draft.targetIndex !== index) return null;

    return (
      <TaskDraftRow
        depth={depth}
        value={draft.value}
        saving={draft.saving}
        error={draft.error}
        onChange={props.onInlineCreateChange}
        onSubmit={props.onInlineCreateSubmit}
        onCancel={props.onInlineCreateCancel}
      />
    );
  };

  const renderNodes = (
    nodes: TaskTreeNode[],
    parentTaskId: string | null,
    depth: number
  ) => (
    <>
      {renderInlineCreateRow(parentTaskId, 0, depth)}
      <For each={nodes}>
        {(node, index) => {
          const childDepth = depth + 1;
          const hasChildren = node.children.length > 0;
          const expanded = () => props.expandedIds.has(node.task.id);

          return (
            <Stack gap="0.5">
              <TaskRow
                task={node.task}
                depth={depth}
                hasChildren={hasChildren}
                childCount={node.children.length}
                expanded={expanded()}
                isActive={props.activeTaskId === node.task.id}
                shouldFocus={props.focusTaskId === node.task.id}
                draggingTaskId={props.draggingTaskId}
                activeDrop={props.activeDrop}
                inlineEditValue={
                  props.inlineEditTaskId === node.task.id ? props.inlineEditValue : null
                }
                inlineEditSaving={
                  props.inlineEditTaskId === node.task.id && props.inlineEditSaving
                }
                inlineEditError={
                  props.inlineEditTaskId === node.task.id ? props.inlineEditError : null
                }
                onToggleExpanded={props.onToggleExpanded}
                onDragStart={props.onDragStart}
                onDragEnd={props.onDragEnd}
                onDrop={props.onDrop}
                onDragEnterTarget={props.onDragEnterTarget}
                onActivate={props.onActivate}
                onClearSelection={props.onClearSelection}
                onFocusSettled={props.onFocusSettled}
                onSelectAdjacent={props.onSelectAdjacent}
                onNavigateTree={props.onNavigateTree}
                onOpenInlineEdit={props.onOpenInlineEdit}
                onOpenDetails={props.onOpenDetails}
                onInlineEditChange={props.onInlineEditChange}
                onInlineEditSubmit={props.onInlineEditSubmit}
                onInlineEditCancel={props.onInlineEditCancel}
                onMoveByKeyboard={props.onMoveByKeyboard}
              />

              <Show when={hasChildren && expanded()}>
                <Stack
                  data-testid={`task-children-${node.task.id}`}
                  gap="0.5"
                  ml="5"
                  pl="2"
                  borderLeftWidth="2px"
                  borderLeftColor="border.emphasized"
                >
                  {renderNodes(node.children, node.task.id, childDepth)}
                </Stack>
              </Show>

              {renderInlineCreateRow(parentTaskId, index() + 1, depth)}
            </Stack>
          );
        }}
      </For>
    </>
  );

  return (
    <Stack gap="0.5" minH="0" overflow="auto" pr="1">
      <Show
        when={hasRows()}
        fallback={<Box color="fg.muted">No tasks yet. Press N to create the first task.</Box>}
      >
        <Show when={firstRootTaskId()}>
          {(taskId) => (
            <Box
              data-testid="task-drop-top-root"
              h="4"
              borderRadius="md"
              style={{
                "border-top": topRootDropActive()
                  ? "4px solid #2f6fed"
                  : "2px solid transparent",
                background: topRootDropActive() ? "rgba(47, 111, 237, 0.10)" : "transparent",
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragEnter={() => props.onDragEnterTarget(taskId(), "before")}
              onDrop={(event) => {
                event.preventDefault();
                const draggedTaskId =
                  event.dataTransfer?.getData("text/plain")?.trim() || null;
                props.onDrop(taskId(), "before", draggedTaskId);
              }}
            />
          )}
        </Show>
        {renderNodes(props.nodes, null, 0)}
      </Show>

      <Box
        data-testid="task-drop-root"
        h="8"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="border"
        borderRadius="md"
        bg="bg.muted"
        color="fg.muted"
        fontSize="xs"
        display="flex"
        alignItems="center"
        justifyContent="center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const draggedTaskId =
            event.dataTransfer?.getData("text/plain")?.trim() || null;
          props.onDropRoot(draggedTaskId);
        }}
        onDragEnter={() => props.onDragEnterRoot()}
      >
        Drop here to move task to root
      </Box>
    </Stack>
  );
};
