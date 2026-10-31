import { CalendarPlusIcon } from "lucide-solid";
import { Show, createSignal, type VoidComponent } from "solid-js";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { DEFAULT_TIME_ZONE } from "~/lib/events/types";
import { useNoteEvent } from "./NoteEventContext";

/**
 * Compact "make this note an event" affordance: first show date + time.
 * `startOpen` skips the button (the note page opens it from its menu);
 * `onClose` runs when the form is cancelled or submitted.
 */
export const AddEventDates: VoidComponent<{
  startOpen?: boolean;
  onClose?: () => void;
}> = (props) => {
  const { addShows } = useNoteEvent();
  const [open, setOpenSignal] = createSignal(props.startOpen ?? false);
  const setOpen = (next: boolean) => {
    setOpenSignal(next);
    if (!next) props.onClose?.();
  };
  const [date, setDate] = createSignal("");
  const [time, setTime] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!date() || busy()) return;
    setBusy(true);
    const ok = await addShows([
      { date: date(), time: time() || null, timeZone: DEFAULT_TIME_ZONE },
    ]);
    setBusy(false);
    if (ok) {
      setOpen(false);
      setDate("");
      setTime("");
    }
  };

  return (
    <Show
      when={open()}
      fallback={
        <Button
          size="xs"
          variant="plain"
          colorPalette="gray"
          color="fg.muted"
          px="1.5"
          h="7"
          onClick={() => setOpen(true)}
        >
          <CalendarPlusIcon size={14} />
          Add event dates
        </Button>
      }
    >
      <form onSubmit={(e) => void submit(e)} aria-label="Add event dates">
        <Text textStyle="xs" color="fg.muted" mb="1.5">
          First show. Leave the time empty for an all-day show.
        </Text>
        <HStack gap="1.5" flexWrap="wrap">
          <Input
            size="xs"
            type="date"
            aria-label="Show date"
            required
            w="36"
            value={date()}
            onInput={(e) => setDate(e.currentTarget.value)}
            // The note menu gives focus back as it closes, which takes a frame.
            ref={(el) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => el.focus()),
              )
            }
          />
          <Input
            size="xs"
            type="time"
            aria-label="Start time"
            w="28"
            value={time()}
            onInput={(e) => setTime(e.currentTarget.value)}
          />
          <Button size="xs" type="submit" disabled={!date()} loading={busy()}>
            Add
          </Button>
          <Button
            size="xs"
            variant="plain"
            colorPalette="gray"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </HStack>
      </form>
    </Show>
  );
};
