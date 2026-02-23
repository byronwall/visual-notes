import { createAsync, useAction } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import * as Table from "~/components/ui/table";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
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
  startOfMonth,
  startOfYear,
} from "./date-utils";

type ViewMode = "week" | "month" | "year" | "custom";

type Props = {
  open: boolean;
  onClose: () => void;
  weekStart: Date;
  refreshKey: number;
  onChanged: () => void;
};

export const TimeBlockMetadataSummaryDialog = (props: Props) => {
  const [viewMode, setViewMode] = createSignal<ViewMode>("week");
  const [customStart, setCustomStart] = createSignal(props.weekStart);
  const [customEnd, setCustomEnd] = createSignal(endOfMonth(props.weekStart));

  const [newDate, setNewDate] = createSignal(formatDateOnly(props.weekStart));
  const [newKey, setNewKey] = createSignal("");
  const [newValue, setNewValue] = createSignal("");
  const [newContributor, setNewContributor] = createSignal("default");
  const [newComments, setNewComments] = createSignal("");

  const range = createMemo(() => {
    if (viewMode() === "week") {
      return {
        start: props.weekStart,
        end: addDays(props.weekStart, 7),
      };
    }
    if (viewMode() === "month") {
      return {
        start: startOfMonth(props.weekStart),
        end: endOfMonth(props.weekStart),
      };
    }
    if (viewMode() === "year") {
      return {
        start: startOfYear(props.weekStart),
        end: endOfYear(props.weekStart),
      };
    }
    return {
      start: customStart(),
      end: customEnd(),
    };
  });

  const entries = createAsync(() => {
    void props.refreshKey;
    return fetchDateRangeTimeBlockMeta({
      startIso: range().start.toISOString(),
      endIso: range().end.toISOString(),
    });
  });

  const runCreate = useAction(createTimeBlockDayMeta);
  const runUpdate = useAction(updateTimeBlockDayMeta);
  const runDelete = useAction(deleteTimeBlockDayMeta);

  const handleCreate = async () => {
    if (!newDate() || !newKey().trim() || !newValue().trim()) return;
    const date = new Date(`${newDate()}T00:00:00`);
    await runCreate({
      dateIso: date.toISOString(),
      key: newKey().trim(),
      value: newValue().trim(),
      contributor: newContributor().trim() || "default",
      comments: newComments().trim() || undefined,
      noteId: null,
    });
    setNewKey("");
    setNewValue("");
    setNewComments("");
    props.onChanged();
  };

  const handleDelete = async (id: string) => {
    const confirmed = confirm("Delete this metadata entry?");
    if (!confirmed) return;
    await runDelete({ id });
    props.onChanged();
  };

  const handleQuickEdit = async (entry: TimeBlockDayMetadataItem) => {
    const next = prompt("Update metadata value", entry.value);
    if (!next || next.trim() === entry.value) return;
    await runUpdate({ id: entry.id, value: next.trim() });
    props.onChanged();
  };

  return (
    <SimpleDialog
      open={props.open}
      onOpenChange={(open) => !open && props.onClose()}
      title="Metadata Summary"
      description="Track daily context and summaries with contributor labels."
      maxW="1100px"
    >
      <Stack gap="4">
        <HStack gap="2" flexWrap="wrap" alignItems="center">
          <For each={["week", "month", "year", "custom"] as ViewMode[]}>
            {(mode) => (
              <Button
                size="xs"
                variant={viewMode() === mode ? "solid" : "outline"}
                onClick={() => setViewMode(mode)}
              >
                {mode[0].toUpperCase() + mode.slice(1)}
              </Button>
            )}
          </For>
          <Text fontSize="sm" color="fg.muted" ml="2">
            {formatMonthDay(range().start)} - {formatMonthDay(range().end)}
          </Text>
        </HStack>

        <Show when={viewMode() === "custom"}>
          <HStack gap="2" flexWrap="wrap">
            <Input
              type="date"
              value={formatDateOnly(customStart())}
              onInput={(event) => setCustomStart(new Date(`${event.currentTarget.value}T00:00:00`))}
            />
            <Input
              type="date"
              value={formatDateOnly(customEnd())}
              onInput={(event) => setCustomEnd(new Date(`${event.currentTarget.value}T00:00:00`))}
            />
          </HStack>
        </Show>

        <Box borderWidth="1px" borderColor="border" borderRadius="md" p="3">
          <Stack gap="2">
            <Text fontWeight="medium" fontSize="sm">Add / Upsert Metadata</Text>
            <HStack gap="2" flexWrap="wrap" alignItems="flex-end">
              <Stack gap="1" minW="40">
                <Text fontSize="xs" color="fg.muted">Date</Text>
                <Input type="date" value={newDate()} onInput={(event) => setNewDate(event.currentTarget.value)} />
              </Stack>
              <Stack gap="1" minW="32">
                <Text fontSize="xs" color="fg.muted">Key</Text>
                <Input value={newKey()} onInput={(event) => setNewKey(event.currentTarget.value)} placeholder="energy" />
              </Stack>
              <Stack gap="1" minW="48">
                <Text fontSize="xs" color="fg.muted">Value</Text>
                <Input value={newValue()} onInput={(event) => setNewValue(event.currentTarget.value)} placeholder="7/10" />
              </Stack>
              <Stack gap="1" minW="32">
                <Text fontSize="xs" color="fg.muted">Contributor</Text>
                <Input value={newContributor()} onInput={(event) => setNewContributor(event.currentTarget.value)} placeholder="default" />
              </Stack>
              <Button size="sm" onClick={() => void handleCreate()}>Save</Button>
            </HStack>
            <Textarea
              rows={2}
              value={newComments()}
              onInput={(event) => setNewComments(event.currentTarget.value)}
              placeholder="Optional comments"
            />
          </Stack>
        </Box>

        <Box borderWidth="1px" borderColor="border" borderRadius="md" overflow="auto" maxH="420px">
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.Header>Date</Table.Header>
                <Table.Header>Key</Table.Header>
                <Table.Header>Contributor</Table.Header>
                <Table.Header>Value</Table.Header>
                <Table.Header>Comments</Table.Header>
                <Table.Header textAlign="right">Actions</Table.Header>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              <Show when={(entries() || []).length > 0} fallback={
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <Text color="fg.muted" py="4">No metadata entries in range.</Text>
                  </Table.Cell>
                </Table.Row>
              }>
                <For each={entries() || []}>
                  {(entry) => (
                    <Table.Row>
                      <Table.Cell>{formatDateOnly(new Date(entry.date))}</Table.Cell>
                      <Table.Cell>{entry.key}</Table.Cell>
                      <Table.Cell>{entry.contributor}</Table.Cell>
                      <Table.Cell>{entry.value}</Table.Cell>
                      <Table.Cell>{entry.comments || "-"}</Table.Cell>
                      <Table.Cell>
                        <HStack justifyContent="flex-end" gap="2">
                          <Button size="xs" variant="outline" onClick={() => void handleQuickEdit(entry)}>
                            Edit
                          </Button>
                          <Button size="xs" variant="subtle" colorPalette="red" onClick={() => void handleDelete(entry.id)}>
                            Delete
                          </Button>
                        </HStack>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </For>
              </Show>
            </Table.Body>
          </Table.Root>
        </Box>
      </Stack>
    </SimpleDialog>
  );
};
