import {
  ChevronDownIcon,
  ChevronRightIcon,
  DotIcon,
  GripVerticalIcon,
  SquarePenIcon,
} from "lucide-solid";
import { createEffect, Show } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import type { TaskItem } from "~/services/tasks/tasks.service";
import { TaskMarkdownPreview } from "./TaskMarkdownPreview";

type DropKind = "before" | "inside" | "after";
type MoveDirection = "up" | "down" | "left" | "right";

type Props = {
  task: TaskItem;
  depth: number;
  hasChildren: boolean;
  childCount: number;
  expanded: boolean;
  isActive: boolean;
  shouldFocus: boolean;
  draggingTaskId: string | null;
  activeDrop: { taskId: string; kind: DropKind } | null;
  inlineEditValue: string | null;
  inlineEditSaving: boolean;
  inlineEditError: string | null;
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
  onMoveByKeyboard: (taskId: string, direction: MoveDirection) => void;
};

const inlineInputClass = css({
  appearance: "none",
  bg: "transparent",
  borderWidth: "0",
  boxShadow: "none",
  color: "fg.default",
  flex: "1",
  fontSize: "sm",
  fontWeight: "medium",
  lineHeight: "1.3",
  minW: "0",
  outline: "none",
  p: "0",
  w: "full",
  _placeholder: {
    color: "fg.muted",
  },
});

const ACTIVE_BORDER_COLOR = "#2f6fed";
const ACTIVE_BORDER_SOFT = "#8fb4ff";
const ACTIVE_BG_COLOR = "rgba(47, 111, 237, 0.10)";

export const TaskRow = (props: Props) => {
  let inlineInputRef: HTMLInputElement | undefined;
  let rowRef: HTMLDivElement | undefined;
  let hasFocusedInlineInput = false;

  createEffect(() => {
    if (props.inlineEditValue === null) {
      hasFocusedInlineInput = false;
      return;
    }
    if (!inlineInputRef || hasFocusedInlineInput) return;
    hasFocusedInlineInput = true;
    queueMicrotask(() => {
      inlineInputRef?.focus();
      const descriptionLength = props.task.description.length;
      inlineInputRef?.setSelectionRange(0, descriptionLength);
    });
  });

  createEffect(() => {
    if (!props.shouldFocus || !rowRef) return;
    queueMicrotask(() => {
      rowRef?.focus();
      props.onFocusSettled(props.task.id);
    });
  });

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
  const isInlineEditing = () => props.inlineEditValue !== null;

  return (
    <Stack gap="0.5">
      <Box
        data-testid={`task-drop-before-${props.task.id}`}
        h={beforeActive() ? "2" : "0.5"}
        style={{
          "border-top": beforeActive() ? `4px solid ${ACTIVE_BORDER_COLOR}` : "0 solid transparent",
          "border-radius": "999px",
          background: beforeActive() ? ACTIVE_BG_COLOR : "transparent",
        }}
        onDragOver={handleDragOver}
        onDragEnter={() => props.onDragEnterTarget(props.task.id, "before")}
        onDrop={handleDrop("before")}
      />

      <HStack
        ref={(node) => {
          rowRef = node;
        }}
        data-testid={`task-row-${props.task.id}`}
        data-selected={props.isActive ? "true" : "false"}
        data-drop-kind={
          insideActive() ? "inside" : beforeActive() ? "before" : afterActive() ? "after" : "none"
        }
        gap="2"
        borderWidth="1px"
        borderColor="border"
        borderRadius="md"
        px="2"
        py="1"
        bg={isDraggingSelf() ? "bg.muted" : "bg"}
        style={{
          border: "1px solid #e7e9e7",
          background:
            isDraggingSelf()
              ? undefined
              : insideActive() || props.isActive
                ? ACTIVE_BG_COLOR
                : undefined,
          "box-shadow": insideActive()
            ? `0 0 0 1px ${ACTIVE_BORDER_COLOR}`
            : props.isActive
              ? `0 0 0 1px ${ACTIVE_BORDER_SOFT}`
              : "none",
        }}
        opacity={isDraggingSelf() ? 0.5 : 1}
        tabIndex={0}
        onFocus={() => props.onActivate(props.task.id)}
        onClick={() => props.onActivate(props.task.id)}
        onKeyDown={(event) => {
          if (isInlineEditing()) return;

          if (!event.altKey) {
            if (event.key === "Escape") {
              event.preventDefault();
              props.onClearSelection();
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              props.onSelectAdjacent(props.task.id, "up");
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              props.onSelectAdjacent(props.task.id, "down");
              return;
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              props.onNavigateTree(props.task.id, "left");
              return;
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              props.onNavigateTree(props.task.id, "right");
              return;
            }
          }

          if (event.altKey) {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              props.onMoveByKeyboard(props.task.id, "up");
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              props.onMoveByKeyboard(props.task.id, "down");
              return;
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              props.onMoveByKeyboard(props.task.id, "left");
              return;
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              props.onMoveByKeyboard(props.task.id, "right");
              return;
            }
          }

          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            props.onOpenDetails(props.task);
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();
            props.onOpenInlineEdit(props.task);
            return;
          }

          if (event.key === "F2") {
            event.preventDefault();
            props.onOpenInlineEdit(props.task);
          }
        }}
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
          color="fg.muted"
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.dataTransfer?.setData("text/plain", props.task.id);
            event.dataTransfer!.effectAllowed = "move";
            props.onDragStart(props.task.id);
          }}
          onDragEnd={() => props.onDragEnd()}
        >
          <GripVerticalIcon size={14} />
        </Box>

        <Stack gap="0" flex="1" minW="0">
          <HStack gap="2" alignItems="center" minW="0">
            <Show
              when={isInlineEditing()}
              fallback={
                <TaskMarkdownPreview
                  markdown={props.task.description}
                  onClick={() => {
                    props.onActivate(props.task.id);
                    props.onOpenInlineEdit(props.task);
                  }}
                />
              }
            >
              <input
                ref={(node) => {
                  inlineInputRef = node;
                }}
                value={props.inlineEditValue ?? ""}
                onClick={(event) => event.stopPropagation()}
                onInput={(event) => props.onInlineEditChange(event.currentTarget.value)}
                onBlur={() => {
                  if (!props.inlineEditSaving) props.onInlineEditSubmit();
                }}
                onKeyDown={(event) => {
                  if (event.altKey) {
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      props.onMoveByKeyboard(props.task.id, "up");
                      return;
                    }
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      props.onMoveByKeyboard(props.task.id, "down");
                      return;
                    }
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      props.onMoveByKeyboard(props.task.id, "left");
                      return;
                    }
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      props.onMoveByKeyboard(props.task.id, "right");
                      return;
                    }
                  }
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    props.onInlineEditSubmit();
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    props.onInlineEditCancel();
                    return;
                  }
                }}
                disabled={props.inlineEditSaving}
                placeholder="Task title. Use #tags inline"
                class={inlineInputClass}
                data-testid={`task-inline-input-${props.task.id}`}
              />
            </Show>
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
            <IconButton
              size="2xs"
              variant="plain"
              aria-label={`Edit details for ${props.task.description}`}
              onClick={(event) => {
                event.stopPropagation();
                props.onActivate(props.task.id);
                props.onOpenDetails(props.task);
              }}
            >
              <SquarePenIcon size={14} />
            </IconButton>
          </HStack>

          <HStack gap="2" color="fg.muted" fontSize="xs" flexWrap="wrap" minH="4">
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
            <Show when={props.inlineEditError}>
              {(error) => (
                <Text color="red.fg">
                  {error()}
                </Text>
              )}
            </Show>
          </HStack>
        </Stack>

      </HStack>

      <Box
        data-testid={`task-drop-after-${props.task.id}`}
        h={afterActive() ? "2" : "0.5"}
        style={{
          "border-bottom": afterActive() ? `4px solid ${ACTIVE_BORDER_COLOR}` : "0 solid transparent",
          "border-radius": "999px",
          background: afterActive() ? ACTIVE_BG_COLOR : "transparent",
        }}
        onDragOver={handleDragOver}
        onDragEnter={() => props.onDragEnterTarget(props.task.id, "after")}
        onDrop={handleDrop("after")}
      />
    </Stack>
  );
};
