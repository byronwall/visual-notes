import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  type VoidComponent,
} from "solid-js";
import { createStore } from "solid-js/store";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { formatShowWhen } from "~/lib/events/format";
import { weekday } from "~/lib/events/time";
import { DEFAULT_TIME_ZONE } from "~/lib/events/types";
import { FieldRow } from "./EventDetailsForm";
import { useNoteEvent } from "./NoteEventContext";
import {
  repeatDraftFrom,
  repeatError,
  repeatInput,
  repeatPreview,
  type RepeatDraft,
} from "./repeat-draft";
import { RepeatRuleFields } from "./RepeatRuleFields";
import type { ShowDraft } from "./show-draft";

/** Builds a run of shows from a rule, previewing every date first. */
export const RepeatDialog: VoidComponent<{
  open: boolean;
  initial: ShowDraft | null;
  onClose: () => void;
}> = (props) => {
  const { event, addRepeat } = useNoteEvent();
  const [draft, setDraft] = createStore<RepeatDraft>(
    repeatDraftFrom({ date: "", time: "", endTime: "", timeZone: "" }),
  );
  const [busy, setBusy] = createSignal(false);

  createEffect(() => {
    if (props.open && props.initial) setDraft(repeatDraftFrom(props.initial));
  });

  const taken = createMemo(
    () => new Set(event()?.occurrences.map((o) => o.startsAt) ?? []),
  );
  const preview = createMemo(() =>
    repeatPreview({ ...draft, weekdays: [...draft.weekdays] }),
  );
  const newCount = () =>
    preview()?.shows.filter((s) => !taken().has(s.startsAt)).length ?? 0;
  const currentYear = new Date().getFullYear();
  const tz = () => draft.timeZone.trim() || DEFAULT_TIME_ZONE;

  // Weekly repeats follow the first date's weekday until days are hand-picked.
  const changeDate = (date: string) => {
    const prev = draft.date;
    const followsDate =
      draft.weekdays.length === 0 ||
      (prev !== "" &&
        draft.weekdays.length === 1 &&
        draft.weekdays[0] === weekday(prev));
    setDraft("date", date);
    if (followsDate && date) setDraft("weekdays", [weekday(date)]);
  };

  const submit = async () => {
    if (repeatError(draft) || newCount() === 0 || busy()) return;
    setBusy(true);
    const ok = await addRepeat(repeatInput(draft));
    setBusy(false);
    if (ok) props.onClose();
  };

  return (
    <SimpleDialog
      open={props.open}
      onClose={props.onClose}
      title="Repeat shows"
      maxW="480px"
      phoneSheet
      closeOnInteractOutside={false}
      footer={
        <HStack justify="space-between" gap="2" w="full">
          <Text textStyle="xs" color="red.fg">
            {repeatError(draft)}
          </Text>
          <HStack gap="2">
            <Button size="sm" variant="outline" onClick={props.onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={busy()}
              disabled={newCount() === 0}
              onClick={() => void submit()}
            >
              Add {newCount()} {newCount() === 1 ? "show" : "shows"}
            </Button>
          </HStack>
        </HStack>
      }
    >
      <Stack gap="3">
        <Grid
          gridTemplateColumns="6rem minmax(0, 1fr)"
          columnGap="3"
          rowGap="2"
        >
          <FieldRow label="First date">
            <Input
              size="xs"
              type="date"
              aria-label="First date"
              w="36"
              value={draft.date}
              onInput={(e) => changeDate(e.currentTarget.value)}
            />
          </FieldRow>
          <FieldRow label="Time">
            <HStack gap="1.5">
              <Input
                size="xs"
                type="time"
                aria-label="Start time"
                w="28"
                value={draft.time}
                onInput={(e) => setDraft("time", e.currentTarget.value)}
              />
              <Text textStyle="xs" color="fg.muted">
                to
              </Text>
              <Input
                size="xs"
                type="time"
                aria-label="End time"
                w="28"
                disabled={!draft.time}
                value={draft.endTime}
                onInput={(e) => setDraft("endTime", e.currentTarget.value)}
              />
            </HStack>
          </FieldRow>
          <RepeatRuleFields draft={draft} setDraft={setDraft} />
        </Grid>

        <Box borderTopWidth="1px" borderColor="border" pt="2">
          <Show
            when={preview()}
            fallback={
              <Text textStyle="xs" color="fg.muted">
                Fill in the rule to preview dates.
              </Text>
            }
          >
            {(p) => (
              <>
                <Text textStyle="sm" fontWeight="medium" mb="1">
                  {p().summary}
                  <Text as="span" color="fg.muted" fontWeight="normal">
                    {" "}
                    · {p().shows.length}{" "}
                    {p().shows.length === 1 ? "date" : "dates"}
                  </Text>
                </Text>
                <Stack
                  gap="0"
                  maxH="48"
                  overflowY="auto"
                  aria-label="Preview dates"
                >
                  <For each={p().shows}>
                    {(show) => (
                      <HStack justify="space-between" gap="2" py="0.5">
                        <Text
                          textStyle="xs"
                          color={
                            taken().has(show.startsAt)
                              ? "fg.subtle"
                              : "fg.default"
                          }
                        >
                          {formatShowWhen(
                            {
                              ...show,
                              allDay: !draft.time,
                              timeConfirmed: true,
                              timeZone: tz(),
                            },
                            currentYear,
                          )}
                        </Text>
                        <Show when={taken().has(show.startsAt)}>
                          <Text textStyle="xs" color="fg.subtle">
                            already added
                          </Text>
                        </Show>
                      </HStack>
                    )}
                  </For>
                </Stack>
              </>
            )}
          </Show>
        </Box>
      </Stack>
    </SimpleDialog>
  );
};
