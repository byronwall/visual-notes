import { useAction } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { FileTextIcon, LockIcon, Trash2Icon } from "lucide-solid";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { IconButton } from "~/components/ui/icon-button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import {
  deleteTimeBlock,
  deleteTimeBlocksByDateRange,
  fetchWeeklyTimeBlocks,
  type TimeBlockItem,
} from "~/services/time-blocks/time-blocks.service";
import { formatBlockRange } from "./BlockFace";
import {
  addDays,
  endOfDay,
  formatDuration,
  formatMonthDay,
  formatWeekdayShort,
  isSameDay,
  MS_PER_MINUTE,
  startOfDay,
} from "./date-utils";
import { normalizeTimeBlockColor } from "./time-block-colors";
import { useNestedDialogGuard } from "./useNestedDialogGuard";
import { formatRangeLabel } from "./TimeBlocksToolbar";
import { createKeptAsync } from "~/utils/kept-async";

type Props = {
  open: boolean;
  onClose: () => void;
  weekStart: Date;
  numberOfDays: number;
  noteId?: string;
  onEdit: (block: TimeBlockItem) => void;
  refreshKey: number;
  onChanged: () => void;
};

const row = css({
  display: "flex",
  alignItems: "center",
  gap: "3",
  px: "2",
  py: "1.5",
  borderRadius: "md",
  cursor: "pointer",
  w: "full",
  transition: "background-color 140ms ease",
  _hover: { bg: "bg.muted" },
  _focusVisible: {
    outline: "2px solid var(--colors-fg-default)",
    outlineOffset: "-2px",
  },
  "& [data-row-action]": { opacity: 0, transition: "opacity 140ms ease" },
  "&:hover [data-row-action], &:focus-within [data-row-action]": {
    opacity: 1,
  },
  "@media (hover: none)": { "& [data-row-action]": { opacity: 1 } },
});

const tabular = { "font-variant-numeric": "tabular-nums" } as const;

const minutesOf = (block: TimeBlockItem) =>
  (new Date(block.endTime).getTime() - new Date(block.startTime).getTime()) /
  MS_PER_MINUTE;

const dayLabel = (date: Date) =>
  `${formatWeekdayShort(date)} ${formatMonthDay(date)}`;

/** The visible range as a list: one compact row per block, grouped by day. */
export const TimeBlocksListDialog = (props: Props) => {
  const blocks = createKeptAsync(() => {
    // Re-run after mutations initiated by the calendar.
    void props.refreshKey;
    return fetchWeeklyTimeBlocks({
      weekStartIso: props.weekStart.toISOString(),
      numberOfDays: props.numberOfDays,
      noteId: props.noteId,
    });
  });

  const runDelete = useAction(deleteTimeBlock);
  const runDeleteRange = useAction(deleteTimeBlocksByDateRange);
  const [deleteBlock, setDeleteBlock] = createSignal<TimeBlockItem | null>(
    null,
  );
  const [deleteDay, setDeleteDay] = createSignal<Date | null>(null);

  const nestedGuard = useNestedDialogGuard(
    () => deleteBlock() !== null || deleteDay() !== null,
  );

  const days = createMemo(() =>
    Array.from({ length: props.numberOfDays }, (_, index) => {
      const date = addDays(props.weekStart, index);
      const items = (blocks.latest ?? [])
        .filter((block) => isSameDay(new Date(block.startTime), date))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const minutes = items.reduce((sum, block) => sum + minutesOf(block), 0);
      return { date, items, minutes };
    }).filter((day) => day.items.length > 0),
  );

  const deleteDayDescription = () => {
    const date = deleteDay();
    if (!date) return "";
    const count =
      days().find((day) => isSameDay(day.date, date))?.items.length ?? 0;
    return `Delete all ${count} ${count === 1 ? "block" : "blocks"} on ${dayLabel(date)}?`;
  };

  return (
    <SimpleDialog
      open={props.open}
      onOpenChange={(open) => !open && props.onClose()}
      title={formatRangeLabel(props.weekStart, props.numberOfDays)}
      // A click inside a nested confirm must not dismiss this dialog.
      closeOnInteractOutside={!nestedGuard()}
      maxW="calc(100vw - 32px)"
      contentClass={css({ width: "min(640px, calc(100vw - 32px))" })}
    >
      <Show
        when={days().length > 0}
        fallback={
          <Text color="fg.muted" fontSize="sm" py="6" textAlign="center">
            No blocks in this range.
          </Text>
        }
      >
        <Stack gap="4">
          <For each={days()}>
            {(day) => (
              <Stack gap="0.5" data-testid="time-blocks-list-day">
                <HStack gap="2" px="2" h="8">
                  <Text fontSize="sm" fontWeight="semibold">
                    {dayLabel(day.date)}
                  </Text>
                  <Text fontSize="xs" color="fg.muted" style={tabular}>
                    {day.items.length}{" "}
                    {day.items.length === 1 ? "block" : "blocks"} ·{" "}
                    {formatDuration(day.minutes)}
                  </Text>
                  <Box flex="1" />
                  <IconButton
                    size="xs"
                    variant="plain"
                    colorPalette="red"
                    aria-label={`Delete all blocks on ${dayLabel(day.date)}`}
                    title="Delete all blocks on this day"
                    onClick={() => setDeleteDay(day.date)}
                  >
                    <Trash2Icon />
                  </IconButton>
                </HStack>
                <For each={day.items}>
                  {(block) => (
                    <div
                      role="button"
                      tabIndex={0}
                      class={row}
                      data-testid="time-blocks-list-row"
                      onClick={() => props.onEdit(block)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        props.onEdit(block);
                      }}
                    >
                      <Box
                        w="2.5"
                        h="2.5"
                        borderRadius="full"
                        flexShrink={0}
                        style={{
                          "background-color": normalizeTimeBlockColor(
                            block.color,
                          ),
                        }}
                      />
                      <Text
                        as="span"
                        fontSize="sm"
                        color="fg.muted"
                        flexShrink={0}
                        w="24"
                        style={tabular}
                      >
                        {formatBlockRange(
                          new Date(block.startTime),
                          new Date(block.endTime),
                        )}
                      </Text>
                      <Stack gap="0" flex="1" minW="0">
                        <Text
                          as="span"
                          fontSize="sm"
                          fontWeight="medium"
                          style={{ "overflow-wrap": "anywhere" }}
                        >
                          {block.title || "Untitled"}
                        </Text>
                        <Show when={block.noteTitle}>
                          {(noteTitle) => (
                            <HStack gap="1" color="fg.muted" minW="0">
                              <FileTextIcon size={12} />
                              <Text as="span" fontSize="xs" truncate>
                                {noteTitle()}
                              </Text>
                            </HStack>
                          )}
                        </Show>
                      </Stack>
                      <Show when={block.isFixedTime}>
                        <Box color="fg.muted" flexShrink={0} title="Fixed time">
                          <LockIcon size={13} />
                        </Box>
                      </Show>
                      <Text
                        as="span"
                        fontSize="xs"
                        color="fg.muted"
                        flexShrink={0}
                        style={tabular}
                      >
                        {formatDuration(minutesOf(block))}
                      </Text>
                      <IconButton
                        data-row-action
                        size="2xs"
                        variant="plain"
                        colorPalette="red"
                        aria-label={`Delete ${block.title || "Untitled"}`}
                        title="Delete block"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteBlock(block);
                        }}
                      >
                        <Trash2Icon />
                      </IconButton>
                    </div>
                  )}
                </For>
              </Stack>
            )}
          </For>
        </Stack>
      </Show>

      <ConfirmDialog
        open={deleteBlock() !== null}
        onOpenChange={(open) => !open && setDeleteBlock(null)}
        title="Delete time block"
        description={`Delete “${deleteBlock()?.title || "Untitled"}”?`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          const block = deleteBlock();
          if (!block) return;
          void runDelete({ id: block.id }).then(() => props.onChanged());
        }}
      />

      <ConfirmDialog
        open={deleteDay() !== null}
        onOpenChange={(open) => !open && setDeleteDay(null)}
        title="Delete day"
        description={deleteDayDescription()}
        confirmLabel="Delete day"
        destructive
        onConfirm={() => {
          const date = deleteDay();
          if (!date) return;
          void runDeleteRange({
            startIso: startOfDay(date).toISOString(),
            endIso: endOfDay(date).toISOString(),
          }).then(() => props.onChanged());
        }}
      />
    </SimpleDialog>
  );
};
