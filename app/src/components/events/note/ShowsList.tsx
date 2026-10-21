import { ChevronRightIcon, PlusIcon, RepeatIcon } from "lucide-solid";
import {
  For,
  Show,
  createMemo,
  createSignal,
  type VoidComponent,
} from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { instantToWallClock } from "~/lib/events/time";
import { DEFAULT_TIME_ZONE, type Occurrence } from "~/lib/events/types";
import { useNoteEvent } from "./NoteEventContext";
import { RepeatDialog } from "./RepeatDialog";
import { draftFromShow, emptyShowDraft, type ShowDraft } from "./show-draft";
import { ShowEditorDialog } from "./ShowEditorDialog";
import { ShowRow } from "./ShowRow";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A show is past once it has ended; untimed shows last their whole day. */
const isPast = (show: Occurrence, now: number) => {
  const start = Date.parse(show.startsAt);
  const end = show.endsAt
    ? Date.parse(show.endsAt)
    : show.allDay || !show.timeConfirmed
      ? start + DAY_MS
      : start;
  return end < now;
};

/** New shows copy the latest show's times so a run of dates is quick. */
const nextDraft = (shows: Occurrence[]): ShowDraft => {
  const today = instantToWallClock(new Date(), DEFAULT_TIME_ZONE).date;
  const last = shows[shows.length - 1];
  if (!last) return emptyShowDraft(today);
  const copy = draftFromShow(last);
  return {
    ...emptyShowDraft(today),
    time: copy.time,
    endTime: copy.endTime,
    timeZone: copy.timeZone,
  };
};

export const ShowsList: VoidComponent = () => {
  const { event, addShows } = useNoteEvent();
  const [showPast, setShowPast] = createSignal(false);
  const [adding, setAdding] = createSignal<ShowDraft | null>(null);
  const [repeating, setRepeating] = createSignal<ShowDraft | null>(null);
  const now = Date.now();

  const shows = () => event()?.occurrences ?? [];
  const split = createMemo(() => {
    const past: Occurrence[] = [];
    const upcoming: Occurrence[] = [];
    for (const show of shows())
      (isPast(show, now) ? past : upcoming).push(show);
    return { past, upcoming };
  });

  return (
    <Stack gap="1" mt="3">
      <HStack justify="space-between" gap="2">
        <Text textStyle="xs" fontWeight="semibold" color="fg.muted">
          Shows
          <Text as="span" fontWeight="normal" color="fg.subtle" ml="1">
            {shows().length}
          </Text>
        </Text>
        <HStack gap="0.5">
          <Button
            size="xs"
            variant="plain"
            colorPalette="gray"
            h="6"
            px="1.5"
            onClick={() => setAdding(nextDraft(shows()))}
          >
            <PlusIcon size={13} />
            Add show
          </Button>
          <Button
            size="xs"
            variant="plain"
            colorPalette="gray"
            h="6"
            px="1.5"
            onClick={() => setRepeating(nextDraft(shows()))}
          >
            <RepeatIcon size={13} />
            Repeat…
          </Button>
        </HStack>
      </HStack>

      <Show when={split().past.length > 0}>
        <Button
          size="xs"
          variant="plain"
          colorPalette="gray"
          color="fg.muted"
          h="6"
          px="1"
          justifyContent="flex-start"
          aria-expanded={showPast()}
          onClick={() => setShowPast(!showPast())}
        >
          <ChevronRightIcon
            size={13}
            style={{ transform: showPast() ? "rotate(90deg)" : undefined }}
          />
          {split().past.length} past{" "}
          {split().past.length === 1 ? "show" : "shows"}
        </Button>
        <Show when={showPast()}>
          <Stack gap="0" opacity="0.75">
            <For each={split().past}>{(show) => <ShowRow show={show} />}</For>
          </Stack>
        </Show>
      </Show>

      <Stack gap="0">
        <For each={split().upcoming}>{(show) => <ShowRow show={show} />}</For>
      </Stack>
      <Show when={shows().length > 0 && split().upcoming.length === 0}>
        <Text textStyle="xs" color="fg.muted" px="1">
          No upcoming shows.
        </Text>
      </Show>

      <ShowEditorDialog
        open={adding() !== null}
        title="Add show"
        initial={adding()}
        submitLabel="Add show"
        onClose={() => setAdding(null)}
        onSubmit={(input) => addShows([input])}
      />
      <RepeatDialog
        open={repeating() !== null}
        initial={repeating()}
        onClose={() => setRepeating(null)}
      />
    </Stack>
  );
};
