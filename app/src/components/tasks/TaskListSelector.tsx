import { PencilIcon, Trash2Icon } from "lucide-solid";
import { batch, For, Show, createEffect, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import type { TaskListItem } from "~/services/tasks/tasks.service";

type Props = {
  lists: TaskListItem[];
  selectedListId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (list: TaskListItem, nextName: string) => void | Promise<void>;
  onDelete: (list: TaskListItem) => Promise<void>;
};

const getDisplayName = (list: TaskListItem) => list.name.trim() || "Untitled list";

export const TaskListSelector = (props: Props) => {
  const [pendingDelete, setPendingDelete] = createSignal<TaskListItem | null>(null);
  const [hoveredListId, setHoveredListId] = createSignal<string | null>(null);
  const [editingListId, setEditingListId] = createSignal<string | null>(null);
  const [draftName, setDraftName] = createSignal("");
  const [savingListId, setSavingListId] = createSignal<string | null>(null);
  let editingInputRef: HTMLInputElement | undefined;
  let editTriggerRef: HTMLButtonElement | undefined;
  let suppressBlurSubmit = false;

  createEffect(() => {
    if (!editingListId() || !editingInputRef) return;
    queueMicrotask(() => {
      editingInputRef?.focus();
      editingInputRef?.select();
    });
  });

  const startEditing = (list: TaskListItem) => {
    setDraftName(list.name);
    setEditingListId(list.id);
  };

  const cancelEditing = () => {
    batch(() => {
      setDraftName("");
      setEditingListId(null);
      setSavingListId(null);
    });
  };

  const submitEditing = (list: TaskListItem) => {
    suppressBlurSubmit = false;
    const nextName = draftName().trim();
    if (!nextName) {
      setDraftName(list.name);
      setEditingListId(list.id);
      return;
    }
    if (nextName === list.name) {
      cancelEditing();
      return;
    }

    setSavingListId(list.id);
    void props.onRename(list, nextName);
    cancelEditing();
  };

  const closeEditingFromEscape = () => {
    suppressBlurSubmit = true;
    cancelEditing();
    queueMicrotask(() => {
      editingInputRef?.blur();
      editTriggerRef?.focus();
    });
  };

  return (
    <Stack gap="2" minH="0" flex="1" overflow="hidden" data-testid="task-lists-nav">
      <HStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="semibold">Task Lists</Text>
        <Button size="xs" onClick={props.onCreate} data-testid="task-list-create-button">
          New List
        </Button>
      </HStack>

      <Stack gap="1" overflowY="auto" minH="0" pr="1" flex="1">
        <For each={props.lists}>
          {(list) => {
            const isEditing = () => editingListId() === list.id;
            const isRenameVisible = () => hoveredListId() === list.id && !isEditing();
            const isSaving = () => savingListId() === list.id;

            return (
              <Box
                data-testid={`task-list-item-${list.id}`}
                position="relative"
                borderWidth="1px"
                borderColor={props.selectedListId === list.id ? "blue.500" : "border"}
                borderRadius="md"
                px="2"
                pl="10"
                py="2"
                bg={props.selectedListId === list.id ? "bg.subtle" : "bg"}
                onMouseEnter={() => setHoveredListId(list.id)}
                onMouseLeave={() => {
                  if (hoveredListId() === list.id) setHoveredListId(null);
                }}
              >
                <HStack
                  justifyContent="space-between"
                  alignItems="center"
                  gap="2"
                  minW="0"
                  onClick={() => props.onSelect(list.id)}
                >
                  <Box
                    position="absolute"
                    left="2"
                    top="50%"
                    zIndex="1"
                    style={{
                      transform: "translateY(-50%)",
                    }}
                  >
                    <IconButton
                      size="2xs"
                      variant="plain"
                      aria-label={`Rename list ${getDisplayName(list)}`}
                      opacity={isRenameVisible() ? 1 : 0}
                      pointerEvents={isRenameVisible() ? "auto" : "none"}
                      transitionDuration="fast"
                      transitionProperty="common"
                      onClick={(event) => {
                        event.stopPropagation();
                        editTriggerRef = event.currentTarget;
                        startEditing(list);
                      }}
                    >
                      <PencilIcon size={14} />
                    </IconButton>
                  </Box>
                  <HStack flex="1" minW="0" gap="2" alignItems="center">
                    <Show
                      when={isEditing()}
                      fallback={
                        <Text
                          fontSize="md"
                          fontWeight="medium"
                          flex="1"
                          minW="0"
                          cursor="pointer"
                          truncate
                        >
                          {getDisplayName(list)}
                        </Text>
                      }
                    >
                      <input
                        ref={(node) => {
                          editingInputRef = node;
                        }}
                        value={draftName()}
                        onInput={(event) => setDraftName(event.currentTarget.value)}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={() => {
                          if (suppressBlurSubmit) {
                            suppressBlurSubmit = false;
                            return;
                          }
                          submitEditing(list);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submitEditing(list);
                            return;
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            closeEditingFromEscape();
                          }
                        }}
                        disabled={isSaving()}
                        class={css({
                          appearance: "none",
                          bg: "transparent",
                          borderWidth: "0",
                          borderRadius: "0",
                          boxShadow: "none",
                          color: "fg.default",
                          flex: "1",
                          fontSize: "md",
                          fontWeight: "medium",
                          h: "auto",
                          lineHeight: "1.2",
                          minW: "0",
                          outline: "none",
                          p: "0",
                          w: "full",
                          _focus: {
                            outline: "none",
                          },
                          _focusVisible: {
                            outline: "none",
                          },
                          _placeholder: {
                            color: "fg.muted",
                          },
                        })}
                      />
                    </Show>
                    <Text color="fg.muted" fontSize="xs" whiteSpace="nowrap">
                      {list.taskCount}
                    </Text>
                  </HStack>
                  <HStack gap="1">
                    <IconButton
                      size="2xs"
                      variant="plain"
                      colorPalette="red"
                      aria-label={`Delete list ${getDisplayName(list)}`}
                      onClick={() => setPendingDelete(list)}
                    >
                      <Trash2Icon size={14} />
                    </IconButton>
                  </HStack>
                </HStack>
              </Box>
            );
          }}
        </For>
      </Stack>
      <ConfirmDialog
        open={!!pendingDelete()}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete task list?"
        description={
          pendingDelete()
            ? `Delete "${getDisplayName(pendingDelete()!)}" and all of its tasks? This cannot be undone.`
            : "Delete this task list? This cannot be undone."
        }
        confirmLabel="Delete list"
        onConfirm={() => {
          const list = pendingDelete();
          if (!list) return;
          void props.onDelete(list);
          setPendingDelete(null);
        }}
      />
    </Stack>
  );
};
