import { useAction } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack, styled } from "styled-system/jsx";
import { Trash2Icon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import * as Table from "~/components/ui/table";
import { Text } from "~/components/ui/text";
import {
  createTimeBlockDayMeta,
  deleteTimeBlockDayMeta,
  fetchDateRangeTimeBlockMeta,
  updateTimeBlockDayMeta,
  type TimeBlockDayMetadataItem,
} from "~/services/time-blocks/time-blocks.service";
import {
  addDays,
  endOfMonth,
  endOfYear,
  formatDateOnly,
  formatMonthDay,
  formatWeekdayShort,
  parseDateInput,
  startOfMonth,
  startOfYear,
} from "./date-utils";
import { useNestedDialogGuard } from "./useNestedDialogGuard";
import { createKeptAsync } from "~/utils/kept-async";

type ViewMode = "range" | "month" | "year" | "custom";

const MODES: Array<{ id: ViewMode; label: string }> = [
  { id: "range", label: "Shown days" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "custom", label: "Custom" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  weekStart: Date;
  numberOfDays?: number;
  refreshKey: number;
  onChanged: () => void;
};

const fieldLabel = css({ fontSize: "xs", color: "fg.muted" });

const editableValue = css({
  all: "unset",
  display: "block",
  w: "full",
  px: "1",
  mx: "-1",
  borderRadius: "sm",
  cursor: "text",
  overflowWrap: "anywhere",
  transition: "background-color 140ms ease",
  _hover: { bg: "bg.muted" },
  _focusVisible: { outline: "2px solid var(--colors-fg-default)" },
});

const dayLabel = (date: Date) =>
  `${formatWeekdayShort(date)} ${formatMonthDay(date)}`;

/** Day metadata (energy, focus, location…) for a range, editable in place. */
export const TimeBlockMetadataSummaryDialog = (props: Props) => {
  const [viewMode, setViewMode] = createSignal<ViewMode>("range");
  const [customStart, setCustomStart] = createSignal<Date | null>(null);
  const [customEnd, setCustomEnd] = createSignal<Date | null>(null);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [pendingDelete, setPendingDelete] =
    createSignal<TimeBlockDayMetadataItem | null>(null);

  const nestedGuard = useNestedDialogGuard(() => pendingDelete() !== null);

  const [newDate, setNewDate] = createSignal("");
  const [newKey, setNewKey] = createSignal("");
  const [newValue, setNewValue] = createSignal("");
  const [newContributor, setNewContributor] = createSignal("default");
  const [saving, setSaving] = createSignal(false);

  /** Inclusive start and end days of the selected range. */
  const range = createMemo(() => {
    const days = props.numberOfDays ?? 7;
    switch (viewMode()) {
      case "month":
        return {
          start: startOfMonth(props.weekStart),
          end: endOfMonth(props.weekStart),
        };
      case "year":
        return {
          start: startOfYear(props.weekStart),
          end: endOfYear(props.weekStart),
        };
      case "custom":
        return {
          start: customStart() ?? props.weekStart,
          end: customEnd() ?? endOfMonth(props.weekStart),
        };
      default:
        return {
          start: props.weekStart,
          end: addDays(props.weekStart, days - 1),
        };
    }
  });

  const entries = createKeptAsync(() => {
    void props.refreshKey;
    const { start, end } = range();
    return fetchDateRangeTimeBlockMeta({
      startIso: start.toISOString(),
      endIso: addDays(end, 1).toISOString(),
    });
  });

  const runCreate = useAction(createTimeBlockDayMeta);
  const runUpdate = useAction(updateTimeBlockDayMeta);
  const runDelete = useAction(deleteTimeBlockDayMeta);

  const canSave = () =>
    Boolean(newKey().trim() && newValue().trim()) && !saving();

  const handleCreate = async () => {
    if (!canSave()) return;
    const date = parseDateInput(newDate() || formatDateOnly(props.weekStart));
    if (!date) return;
    setSaving(true);
    try {
      await runCreate({
        dateIso: date.toISOString(),
        key: newKey().trim(),
        value: newValue().trim(),
        contributor: newContributor().trim() || "default",
        noteId: null,
      });
      setNewKey("");
      setNewValue("");
      props.onChanged();
    } finally {
      setSaving(false);
    }
  };

  const commitValue = async (entry: TimeBlockDayMetadataItem, next: string) => {
    setEditingId(null);
    const value = next.trim();
    if (!value || value === entry.value) return;
    await runUpdate({ id: entry.id, value });
    props.onChanged();
  };

  const rangeLabel = () => {
    const { start, end } = range();
    return `${formatMonthDay(start)} – ${formatMonthDay(end)}`;
  };

  return (
    <SimpleDialog
      open={props.open}
      onOpenChange={(open) => !open && props.onClose()}
      title="Day summary"
      // A click inside the nested confirm must not dismiss this dialog.
      closeOnInteractOutside={!nestedGuard()}
      maxW="calc(100vw - 32px)"
      contentClass={css({ width: "min(880px, calc(100vw - 32px))" })}
    >
      <Stack gap="4">
        <HStack gap="1" flexWrap="wrap" alignItems="center">
          <For each={MODES}>
            {(mode) => (
              <Button
                size="xs"
                variant={viewMode() === mode.id ? "subtle" : "plain"}
                aria-pressed={viewMode() === mode.id}
                onClick={() => setViewMode(mode.id)}
              >
                {mode.label}
              </Button>
            )}
          </For>
          <Show
            when={viewMode() === "custom"}
            fallback={
              <Text
                fontSize="sm"
                color="fg.muted"
                ml="2"
                style={{ "font-variant-numeric": "tabular-nums" }}
              >
                {rangeLabel()}
              </Text>
            }
          >
            <HStack gap="1.5" ml="2">
              <Input
                size="xs"
                type="date"
                aria-label="From"
                value={formatDateOnly(range().start)}
                onInput={(event) =>
                  setCustomStart(parseDateInput(event.currentTarget.value))
                }
              />
              <Text fontSize="sm" color="fg.muted">
                –
              </Text>
              <Input
                size="xs"
                type="date"
                aria-label="To"
                value={formatDateOnly(range().end)}
                onInput={(event) =>
                  setCustomEnd(parseDateInput(event.currentTarget.value))
                }
              />
            </HStack>
          </Show>
        </HStack>

        <Box
          as="form"
          display="grid"
          gridTemplateColumns={{
            base: "1fr 1fr",
            md: "9rem 1fr 1.5fr 8rem auto",
          }}
          gap="2"
          alignItems="end"
          p="3"
          borderRadius="md"
          bg="bg.subtle"
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <Stack gap="1">
            <styled.label class={fieldLabel} for="tb-meta-date">
              Date
            </styled.label>
            <Input
              id="tb-meta-date"
              size="sm"
              type="date"
              value={newDate() || formatDateOnly(props.weekStart)}
              onInput={(event) => setNewDate(event.currentTarget.value)}
            />
          </Stack>
          <Stack gap="1">
            <styled.label class={fieldLabel} for="tb-meta-key">
              Key
            </styled.label>
            <Input
              id="tb-meta-key"
              size="sm"
              value={newKey()}
              placeholder="energy"
              onInput={(event) => setNewKey(event.currentTarget.value)}
            />
          </Stack>
          <Stack gap="1">
            <styled.label class={fieldLabel} for="tb-meta-value">
              Value
            </styled.label>
            <Input
              id="tb-meta-value"
              size="sm"
              value={newValue()}
              placeholder="7/10"
              onInput={(event) => setNewValue(event.currentTarget.value)}
            />
          </Stack>
          <Stack gap="1">
            <styled.label class={fieldLabel} for="tb-meta-contributor">
              Contributor
            </styled.label>
            <Input
              id="tb-meta-contributor"
              size="sm"
              value={newContributor()}
              onInput={(event) => setNewContributor(event.currentTarget.value)}
            />
          </Stack>
          <Button
            size="sm"
            type="submit"
            disabled={!canSave()}
            loading={saving()}
          >
            Add
          </Button>
        </Box>

        <Box overflow="auto" maxH="min(420px, 50vh)">
          <Show
            when={(entries() ?? []).length > 0}
            fallback={
              <Text color="fg.muted" fontSize="sm" py="6" textAlign="center">
                No day metadata in {rangeLabel()}.
              </Text>
            }
          >
            <Table.Root>
              <Table.Head>
                <Table.Row>
                  <Table.Header>Date</Table.Header>
                  <Table.Header>Key</Table.Header>
                  <Table.Header>Value</Table.Header>
                  <Table.Header>Contributor</Table.Header>
                  <Table.Header w="10" />
                </Table.Row>
              </Table.Head>
              <Table.Body>
                <For each={entries() ?? []}>
                  {(entry) => (
                    <Table.Row data-testid="time-blocks-meta-row">
                      <Table.Cell
                        whiteSpace="nowrap"
                        style={{ "font-variant-numeric": "tabular-nums" }}
                      >
                        {dayLabel(new Date(entry.date))}
                      </Table.Cell>
                      <Table.Cell color="fg.muted">{entry.key}</Table.Cell>
                      <Table.Cell>
                        <Show
                          when={editingId() === entry.id}
                          fallback={
                            <button
                              type="button"
                              class={editableValue}
                              aria-label={`Edit ${entry.key}`}
                              onClick={() => setEditingId(entry.id)}
                            >
                              {entry.value}
                            </button>
                          }
                        >
                          <Input
                            size="xs"
                            autofocus
                            aria-label={`${entry.key} value`}
                            value={entry.value}
                            ref={(el) => queueMicrotask(() => el.select())}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void commitValue(
                                  entry,
                                  event.currentTarget.value,
                                );
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                event.stopPropagation();
                                setEditingId(null);
                              }
                            }}
                            onBlur={(event) =>
                              void commitValue(entry, event.currentTarget.value)
                            }
                          />
                        </Show>
                        <Show when={entry.comments}>
                          <Text fontSize="xs" color="fg.muted">
                            {entry.comments}
                          </Text>
                        </Show>
                      </Table.Cell>
                      <Table.Cell color="fg.muted">
                        {entry.contributor}
                      </Table.Cell>
                      <Table.Cell textAlign="right">
                        <IconButton
                          size="2xs"
                          variant="plain"
                          colorPalette="red"
                          aria-label={`Delete ${entry.key}`}
                          title="Delete entry"
                          onClick={() => setPendingDelete(entry)}
                        >
                          <Trash2Icon />
                        </IconButton>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </For>
              </Table.Body>
            </Table.Root>
          </Show>
        </Box>
      </Stack>

      <ConfirmDialog
        open={pendingDelete() !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete entry"
        description={(() => {
          const entry = pendingDelete();
          return entry
            ? `Delete ${entry.key} (${entry.value}) for ${dayLabel(new Date(entry.date))}?`
            : "";
        })()}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          const entry = pendingDelete();
          if (!entry) return;
          void runDelete({ id: entry.id }).then(() => props.onChanged());
        }}
      />
    </SimpleDialog>
  );
};
