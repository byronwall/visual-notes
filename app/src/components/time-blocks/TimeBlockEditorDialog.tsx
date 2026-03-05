import { useAction } from "@solidjs/router";
import { createEffect, createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { LockIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import * as Switch from "~/components/ui/switch";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import {
  createTimeBlock,
  deleteTimeBlock,
  updateTimeBlock,
  type TimeBlockItem,
} from "~/services/time-blocks/time-blocks.service";
import {
  durationMinutes,
  formatDateOnly,
  formatTime24,
  setDateTimeFromInputs,
} from "./date-utils";
import {
  createTimeBlockColorFromHue,
  extractHueFromColor,
  normalizeTimeBlockColor,
  randomTimeBlockColor,
} from "./time-block-colors";

type Props = {
  open: boolean;
  block: TimeBlockItem | null;
  newRange: { start: Date; end: Date } | null;
  onClose: () => void;
  onSaved: () => void;
};

export const TimeBlockEditorDialog = (props: Props) => {
  const runCreate = useAction(createTimeBlock);
  const runUpdate = useAction(updateTimeBlock);
  const runDelete = useAction(deleteTimeBlock);

  const [title, setTitle] = createSignal("");
  const [isFixedTime, setIsFixedTime] = createSignal(false);
  const [color, setColor] = createSignal(randomTimeBlockColor());
  const [comments, setComments] = createSignal("");
  const [startDate, setStartDate] = createSignal("");
  const [endDate, setEndDate] = createSignal("");
  const [startTime, setStartTime] = createSignal("09:00");
  const [endTime, setEndTime] = createSignal("10:00");
  const [saving, setSaving] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  let titleInputRef: HTMLInputElement | undefined;

  createEffect(() => {
    if (!props.open) return;
    const block = props.block;
    const range = props.newRange;

    if (block) {
      const start = new Date(block.startTime);
      const end = new Date(block.endTime);
      setTitle(block.title || "");
      setIsFixedTime(block.isFixedTime);
      setColor(normalizeTimeBlockColor(block.color, randomTimeBlockColor()));
      setComments(block.comments || "");
      setStartDate(formatDateOnly(start));
      setEndDate(formatDateOnly(end));
      setStartTime(formatTime24(start));
      setEndTime(formatTime24(end));
      return;
    }

    if (range) {
      setTitle("");
      setIsFixedTime(false);
      setColor(randomTimeBlockColor());
      setComments("");
      setStartDate(formatDateOnly(range.start));
      setEndDate(formatDateOnly(range.end));
      setStartTime(formatTime24(range.start));
      setEndTime(formatTime24(range.end));
    }
  });

  createEffect(() => {
    if (!props.open) return;
    queueMicrotask(() => {
      if (!titleInputRef) return;
      titleInputRef.focus();
      titleInputRef.select();
    });
  });

  const activeStart = () =>
    setDateTimeFromInputs(new Date(), startDate(), startTime());
  const activeEnd = () =>
    setDateTimeFromInputs(new Date(), endDate(), endTime());

  const matchesDuration = (minutes: number) => {
    return durationMinutes(activeStart(), activeEnd()) === minutes;
  };

  const applyDuration = (minutes: number) => {
    const next = new Date(activeStart().getTime() + minutes * 60_000);
    setEndDate(formatDateOnly(next));
    setEndTime(formatTime24(next));
  };

  const handleSubmit = async () => {
    if (saving()) return;
    setSaving(true);
    try {
      const start = activeStart();
      const end = activeEnd();
      if (props.block) {
        await runUpdate({
          id: props.block.id,
          title: title() || "Untitled Block",
          startTimeIso: start.toISOString(),
          endTimeIso: end.toISOString(),
          color: color(),
          isFixedTime: isFixedTime(),
          comments: comments() || null,
        });
      } else {
        await runCreate({
          title: title() || "Untitled Block",
          startTimeIso: start.toISOString(),
          endTimeIso: end.toISOString(),
          color: color(),
          isFixedTime: isFixedTime(),
          comments: comments() || undefined,
        });
      }
      props.onSaved();
      props.onClose();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to save time block",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!props.block || deleting()) return;
    const confirmed = confirm(
      "Are you sure you want to delete this time block?",
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await runDelete({ id: props.block.id });
      props.onSaved();
      props.onClose();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to delete time block",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SimpleDialog
      open={props.open}
      onOpenChange={(open) => !open && props.onClose()}
      initialFocusEl={() => titleInputRef ?? null}
      restoreFocus={false}
      maxW="calc(100vw - 48px)"
      contentClass={css({
        width: "fit-content",
        minW: "660px",
      })}
      footer={
        <HStack justifyContent="space-between" w="full">
          <Show when={props.block} fallback={<Box />}>
            <Button
              type="button"
              colorPalette="red"
              variant="subtle"
              onClick={() => void handleDelete()}
              disabled={deleting()}
            >
              {deleting() ? "Deleting..." : "Delete"}
            </Button>
          </Show>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving()}
          >
            <HStack gap="2" alignItems="baseline">
              <Text>
                {saving()
                  ? "Saving..."
                  : props.block
                    ? "Save Changes"
                    : "Create Block"}
              </Text>
              <Text
                fontSize="xs"
                color="fg.muted"
                style={{
                  "font-family":
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
                  "letter-spacing": "0.02em",
                }}
              >
                Enter (Title) / Cmd Enter
              </Text>
            </HStack>
          </Button>
        </HStack>
      }
    >
      <Stack
        gap="4"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          if (!event.metaKey && !event.ctrlKey) return;
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <Stack gap="1.5">
          <Text fontSize="sm" fontWeight="medium">
            Title
          </Text>
          <Input
            ref={(el) => {
              titleInputRef = el;
            }}
            w="640px"
            value={title()}
            placeholder="Deep work"
            onInput={(event) => setTitle(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              void handleSubmit();
            }}
          />
        </Stack>

        <HStack justifyContent="space-between" alignItems="center">
          <HStack gap="2" alignItems="center">
            <Switch.Root
              checked={isFixedTime()}
              onCheckedChange={(d) => setIsFixedTime(Boolean(d.checked))}
            >
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label>
                <HStack gap="1.5" alignItems="center">
                  <LockIcon size={13} />
                  <Text>Fixed Time</Text>
                </HStack>
              </Switch.Label>
            </Switch.Root>
          </HStack>
        </HStack>

        <HStack
          gap="2.5"
          alignItems="flex-end"
          flexWrap="nowrap"
          w="fit-content"
        >
          <Stack gap="1.5" w="152px">
            <Text fontSize="sm" fontWeight="medium">
              Start Date
            </Text>
            <Input
              type="date"
              value={startDate()}
              onInput={(event) => setStartDate(event.currentTarget.value)}
            />
          </Stack>
          <Stack gap="1.5" w="152px">
            <Text fontSize="sm" fontWeight="medium">
              Start Time
            </Text>
            <Input
              type="time"
              value={startTime()}
              onInput={(event) => setStartTime(event.currentTarget.value)}
            />
          </Stack>
          <Stack gap="1.5" w="152px">
            <Text fontSize="sm" fontWeight="medium">
              End Date
            </Text>
            <Input
              type="date"
              value={endDate()}
              onInput={(event) => setEndDate(event.currentTarget.value)}
            />
          </Stack>
          <Stack gap="1.5" w="152px">
            <Text fontSize="sm" fontWeight="medium">
              End Time
            </Text>
            <Input
              type="time"
              value={endTime()}
              onInput={(event) => setEndTime(event.currentTarget.value)}
            />
          </Stack>
        </HStack>

        <Stack gap="1.5">
          <Text fontSize="sm" fontWeight="medium">
            Quick Duration
          </Text>
          <HStack gap="2" flexWrap="wrap">
            <For each={[15, 30, 45, 60, 90, 120, 180, 240]}>
              {(minutes) => (
                <Button
                  size="xs"
                  type="button"
                  variant={matchesDuration(minutes) ? "solid" : "outline"}
                  onClick={() => applyDuration(minutes)}
                >
                  {minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
                </Button>
              )}
            </For>
          </HStack>
        </Stack>

        <Stack gap="1.5">
          <Text fontSize="sm" fontWeight="medium">
            Comments
          </Text>
          <Textarea
            w="640px"
            rows={2}
            value={comments()}
            onInput={(event) => setComments(event.currentTarget.value)}
            placeholder="Context, goals, or blockers for this block."
          />
        </Stack>

        <Stack gap="1.5">
          <Text fontSize="sm" fontWeight="medium">
            Color
          </Text>
          <HStack gap="3" w="640px">
            <Input
              type="range"
              flex="1"
              min="0"
              max="360"
              value={String(extractHueFromColor(color()) ?? 0)}
              onInput={(event) =>
                setColor(
                  createTimeBlockColorFromHue(
                    Number.parseFloat(event.currentTarget.value),
                  ),
                )
              }
              style={{
                background:
                  "linear-gradient(90deg, hsl(0 52% 50%) 0%, hsl(35 52% 50%) 16%, hsl(85 52% 50%) 32%, hsl(150 52% 50%) 48%, hsl(190 52% 50%) 64%, hsl(220 52% 50%) 80%, hsl(280 52% 50%) 100%)",
              }}
            />
            <Box
              w="14"
              h="8"
              borderRadius="md"
              borderWidth="1px"
              borderColor="border"
              style={{ "background-color": color() }}
            />
          </HStack>
        </Stack>
      </Stack>
    </SimpleDialog>
  );
};
