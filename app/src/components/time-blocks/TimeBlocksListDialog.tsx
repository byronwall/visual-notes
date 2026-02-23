import { createAsync, useAction } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { PencilIcon, Trash2Icon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import {
  deleteTimeBlock,
  deleteTimeBlocksByDateRange,
  fetchWeeklyTimeBlocks,
  type TimeBlockItem,
} from "~/services/time-blocks/time-blocks.service";
import {
  addDays,
  endOfDay,
  formatMonthDay,
  formatTime12,
  formatWeekdayLong,
  startOfDay,
} from "./date-utils";

type Props = {
  open: boolean;
  onClose: () => void;
  weekStart: Date;
  numberOfDays: number;
  onEdit: (block: TimeBlockItem) => void;
  refreshKey: number;
  onChanged: () => void;
};

export const TimeBlocksListDialog = (props: Props) => {
  const blocks = createAsync(() => {
    // Re-run after mutations initiated by parent.
    void props.refreshKey;
    return fetchWeeklyTimeBlocks({
      weekStartIso: props.weekStart.toISOString(),
      numberOfDays: props.numberOfDays,
      noteId: undefined,
    });
  });

  const runDelete = useAction(deleteTimeBlock);
  const runDeleteRange = useAction(deleteTimeBlocksByDateRange);
  const [deleteBlockId, setDeleteBlockId] = createSignal<string | null>(null);
  const [deleteDayDate, setDeleteDayDate] = createSignal<Date | null>(null);

  const dates = () =>
    Array.from({ length: props.numberOfDays }, (_, index) =>
      addDays(props.weekStart, index)
    );

  const blocksByDate = () => {
    const map = new Map<string, TimeBlockItem[]>();
    for (const block of blocks() || []) {
      const key = startOfDay(new Date(block.startTime)).toISOString();
      const existing = map.get(key) ?? [];
      existing.push(block);
      map.set(key, existing);
    }
    map.forEach((items) => {
      items.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    });
    return map;
  };

  const handleDelete = async (id: string) => {
    await runDelete({ id });
    props.onChanged();
  };

  const handleDeleteDay = async (date: Date) => {
    await runDeleteRange({
      startIso: startOfDay(date).toISOString(),
      endIso: endOfDay(date).toISOString(),
    });
    props.onChanged();
  };

  return (
    <SimpleDialog
      open={props.open}
      onOpenChange={(open) => !open && props.onClose()}
      title="Time Blocks"
      description="Review and edit your week in list form."
      maxW="calc(100vw - 48px)"
      contentClass={css({
        width: "fit-content",
        minW: "760px",
      })}
    >
      <Stack gap="5" w="760px">
        <Show when={(blocks() || []).length > 0} fallback={<Text color="fg.muted">No blocks in this range.</Text>}>
          <For each={dates()}>
            {(date) => {
              const key = startOfDay(date).toISOString();
              const dayBlocks = blocksByDate().get(key) || [];
              return (
                <Show when={dayBlocks.length > 0}>
                  <Stack gap="2">
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text fontWeight="semibold">
                        {formatWeekdayLong(date)}, {formatMonthDay(date)}
                      </Text>
                      <Button
                        size="xs"
                        variant="plain"
                        colorPalette="red"
                        onClick={() => setDeleteDayDate(date)}
                        aria-label={`Delete all blocks for ${formatWeekdayLong(date)}`}
                        title="Delete Day"
                      >
                        <Trash2Icon size={15} />
                      </Button>
                    </HStack>
                    <For each={dayBlocks}>
                      {(block) => (
                        <HStack
                          justifyContent="space-between"
                          alignItems="stretch"
                          borderWidth="1px"
                          borderColor="border"
                          borderRadius="md"
                          px="3"
                          py="2"
                          w="760px"
                          style={{ "border-left-width": "4px", "border-left-color": block.color || "var(--colors-blue-500)" }}
                        >
                          <Stack gap="0.5" flex="1" minW="0" pr="2">
                            <Text
                              fontWeight="medium"
                              style={{
                                overflow: "hidden",
                                display: "-webkit-box",
                                "-webkit-box-orient": "vertical",
                                "-webkit-line-clamp": "3",
                                "word-break": "break-word",
                                "line-height": "1.25",
                              }}
                            >
                              {block.title || "Untitled Block"}
                            </Text>
                            <Text fontSize="sm" color="fg.muted">
                              {formatTime12(new Date(block.startTime))} - {formatTime12(new Date(block.endTime))}
                            </Text>
                            <Show when={block.noteTitle}>
                              {(noteTitle) => (
                                <Text fontSize="xs" color="fg.subtle">Linked note: {noteTitle()}</Text>
                              )}
                            </Show>
                          </Stack>
                          <HStack gap="1" alignSelf="center">
                            <Button
                              size="xs"
                              variant="plain"
                              onClick={() => props.onEdit(block)}
                              aria-label="Edit block"
                              title="Edit"
                            >
                              <PencilIcon size={15} />
                            </Button>
                            <Button
                              size="xs"
                              variant="plain"
                              colorPalette="red"
                              onClick={() => setDeleteBlockId(block.id)}
                              aria-label="Delete block"
                              title="Delete"
                            >
                              <Trash2Icon size={15} />
                            </Button>
                          </HStack>
                        </HStack>
                      )}
                    </For>
                  </Stack>
                </Show>
              );
            }}
          </For>
        </Show>
      </Stack>

      <ConfirmDialog
        open={deleteBlockId() !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteBlockId(null);
        }}
        title="Delete Time Block"
        description="Delete this time block?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          const id = deleteBlockId();
          if (!id) return;
          void handleDelete(id);
        }}
      />

      <ConfirmDialog
        open={deleteDayDate() !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDayDate(null);
        }}
        title="Delete Day"
        description="Delete all time blocks for this day?"
        confirmLabel="Delete Day"
        cancelLabel="Cancel"
        onConfirm={() => {
          const day = deleteDayDate();
          if (!day) return;
          void handleDeleteDay(day);
        }}
      />
    </SimpleDialog>
  );
};
