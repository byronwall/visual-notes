import { createEffect, createMemo, For, Show } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import type { TaskItem } from "~/services/tasks/tasks.service";
import type { TaskTreeNode } from "./tree";
import { TaskRow } from "./TaskRow";

type DropKind = "before" | "inside" | "after";

type DropTarget = {
  taskId: string;
  kind: DropKind;
};

type Props = {
  nodes: TaskTreeNode[];
  expandedIds: Set<string>;
  draggingTaskId: string | null;
  activeDrop: DropTarget | null;
  onToggleExpanded: (taskId: string) => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDrop: (
    targetTaskId: string,
    kind: DropKind,
    draggedTaskId: string | null
  ) => void;
  onDragEnterTarget: (targetTaskId: string, kind: DropKind) => void;
  onEdit: (task: TaskItem) => void;
  onDropRoot: (draggedTaskId: string | null) => void;
  onDragEnterRoot: () => void;
};

export const TaskTree = (props: Props) => {
  const hasRows = createMemo(() => props.nodes.length > 0);

  createEffect(() => {
    if (props.nodes.length === 0) return;
    const states = props.nodes.map((node) => ({
      id: node.task.id,
      expanded: props.expandedIds.has(node.task.id),
      childCount: node.children.length,
    }));
    console.info(
      `[tasks-tree] render snapshot ${states
        .map((entry) => `${entry.id}:${entry.expanded ? "open" : "closed"}:${entry.childCount}`)
        .join("|")}`
    );
  });

  const renderNode = (node: TaskTreeNode, depth: number) => {
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
          draggingTaskId={props.draggingTaskId}
          activeDrop={props.activeDrop}
          onToggleExpanded={props.onToggleExpanded}
          onDragStart={props.onDragStart}
          onDragEnd={props.onDragEnd}
          onDrop={props.onDrop}
          onDragEnterTarget={props.onDragEnterTarget}
          onEdit={props.onEdit}
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
            <For each={node.children}>{(child) => renderNode(child, depth + 1)}</For>
          </Stack>
        </Show>
      </Stack>
    );
  };

  return (
    <Stack gap="0.5" minH="0" overflow="auto" pr="1">
      <Show
        when={hasRows()}
        fallback={<Box color="fg.muted">No tasks yet. Create the first task in this list.</Box>}
      >
        <For each={props.nodes}>{(node) => renderNode(node, 0)}</For>
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
