import {
  ChevronDownIcon,
  ChevronRightIcon,
  DotIcon,
  GripVerticalIcon,
} from "lucide-solid";
import { Show } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import type { TaskItem } from "~/services/tasks/tasks.service";

type DropKind = "before" | "inside" | "after";

type Props = {
  task: TaskItem;
  depth: number;
  hasChildren: boolean;
  childCount: number;
  expanded: boolean;
  draggingTaskId: string | null;
  activeDrop: { taskId: string; kind: DropKind } | null;
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
};

export const TaskRow = (props: Props) => {
  const isDraggingSelf = () => props.draggingTaskId === props.task.id;

  const handleDrop = (kind: DropKind) => (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedTaskId = event.dataTransfer?.getData("text/plain")?.trim() || null;
    props.onDrop(props.task.id, kind, draggedTaskId);
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
  };

  const beforeActive = () =>
    props.activeDrop?.taskId === props.task.id && props.activeDrop.kind === "before";
  const insideActive = () =>
    props.activeDrop?.taskId === props.task.id && props.activeDrop.kind === "inside";
  const afterActive = () =>
    props.activeDrop?.taskId === props.task.id && props.activeDrop.kind === "after";

  return (
    <Stack gap="0">
      <Box
        data-testid={`task-drop-before-${props.task.id}`}
        h={beforeActive() ? "1.5" : "0"}
        borderRadius="sm"
        bg={beforeActive() ? "blue.subtle" : "transparent"}
        borderWidth={beforeActive() ? "1px" : "0"}
        borderStyle="dashed"
        borderColor={beforeActive() ? "blue.500" : "transparent"}
        onDragOver={handleDragOver}
        onDragEnter={() => props.onDragEnterTarget(props.task.id, "before")}
        onDrop={handleDrop("before")}
      />

      <HStack
        data-testid={`task-row-${props.task.id}`}
        gap="2"
        borderWidth="1px"
        borderColor="border"
        borderRadius="md"
        px="2"
        py="1"
        bg={
          isDraggingSelf()
            ? "bg.muted"
            : props.depth > 0
              ? "bg.subtle"
              : "bg"
        }
        opacity={isDraggingSelf() ? 0.5 : 1}
        onDragOver={handleDragOver}
        onDragEnter={() => props.onDragEnterTarget(props.task.id, "inside")}
        onDrop={handleDrop("inside")}
      >
        <Button
          data-no-drag="true"
          data-testid={`task-toggle-${props.task.id}`}
          size="xs"
          variant="plain"
          onClick={(event) => {
            event.stopPropagation();
            if (!props.hasChildren) return;
            console.info(
              `[tasks-tree] toggle click taskId=${props.task.id} expandedBefore=${props.expanded} childCount=${props.childCount}`
            );
            props.onToggleExpanded(props.task.id);
          }}
          disabled={!props.hasChildren}
          aria-label={props.expanded ? "Collapse task" : "Expand task"}
        >
          <Show when={props.hasChildren} fallback={<DotIcon size={14} />}>
            <Show when={props.expanded} fallback={<ChevronRightIcon size={14} />}>
              <ChevronDownIcon size={14} />
            </Show>
          </Show>
        </Button>

        <Box
          draggable={!isDraggingSelf()}
          cursor="grab"
          onDragStart={(event) => {
            event.dataTransfer?.setData("text/plain", props.task.id);
            event.dataTransfer!.effectAllowed = "move";
            props.onDragStart(props.task.id);
          }}
          onDragEnd={() => props.onDragEnd()}
        >
          <GripVerticalIcon size={14} />
        </Box>

        <Stack gap="0" flex="1" minW="0" cursor="pointer" onClick={() => props.onEdit(props.task)}>
          <HStack gap="2" alignItems="center">
            <Text fontSize="sm" fontWeight="medium" lineClamp={2}>
              {props.task.description}
            </Text>
            <Show when={props.hasChildren}>
              <Box
                borderWidth="1px"
                borderColor="border"
                bg="bg.muted"
                borderRadius="full"
                px="2"
                py="0.5"
              >
                <Text fontSize="2xs" color="fg.muted">
                  {props.childCount} child{props.childCount === 1 ? "" : "ren"}
                </Text>
              </Box>
            </Show>
          </HStack>
          <HStack gap="2" color="fg.muted" fontSize="xs" flexWrap="wrap">
            <Text>{props.task.status}</Text>
            <Show when={props.task.dueDate}>
              {(due) => <Text>{due()}</Text>}
            </Show>
            <Show when={props.task.durationMinutes !== null}>
              <Text>{props.task.durationMinutes}m</Text>
            </Show>
            <Show when={props.task.tags.length > 0}>
              <Text>#{props.task.tags.join(" #")}</Text>
            </Show>
          </HStack>
        </Stack>

        <Box
          data-testid={`task-drop-inside-${props.task.id}`}
          w="6"
          h="6"
          borderRadius="sm"
          bg={insideActive() ? "blue.subtle" : "bg.muted"}
          borderWidth="1px"
          borderColor={insideActive() ? "blue.500" : "border"}
          onDragOver={handleDragOver}
          onDrop={handleDrop("inside")}
          onDragEnter={() => props.onDragEnterTarget(props.task.id, "inside")}
        />
      </HStack>

      <Box
        data-testid={`task-drop-after-${props.task.id}`}
        h={afterActive() ? "1.5" : "0"}
        borderRadius="sm"
        bg={afterActive() ? "blue.subtle" : "transparent"}
        borderWidth={afterActive() ? "1px" : "0"}
        borderStyle="dashed"
        borderColor={afterActive() ? "blue.500" : "transparent"}
        onDragOver={handleDragOver}
        onDragEnter={() => props.onDragEnterTarget(props.task.id, "after")}
        onDrop={handleDrop("after")}
      />
    </Stack>
  );
};
