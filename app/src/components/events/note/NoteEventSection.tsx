import {
  Match,
  Show,
  Suspense,
  Switch,
  createEffect,
  createSignal,
  type VoidComponent,
} from "solid-js";
import { Box } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Text } from "~/components/ui/text";
import { AddEventDates } from "./AddEventDates";
import { EventDetailsForm } from "./EventDetailsForm";
import { EventSummaryRow } from "./EventSummaryRow";
import { NoteEventProvider, useNoteEvent } from "./NoteEventContext";
import { ShowsList } from "./ShowsList";
import { EventFeedToggles } from "~/components/events/feeds/EventFeedToggles";
import { FeedsRefreshProvider } from "~/components/events/feeds/feedsRefresh";

type SectionProps = {
  docId: string;
  /**
   * Full note pages pass this: a note that is not an event renders nothing
   * until `adding` is true (set from the note actions menu). They also start
   * with the event folded to one row, so the note body stays near the top.
   */
  hideWhenEmpty?: boolean;
  adding?: boolean;
  onAddingDone?: () => void;
};

/** The note's "Event" section: details, shows, repeats, and feeds. */
export const NoteEventSection: VoidComponent<SectionProps> = (props) => (
  <FeedsRefreshProvider>
    <NoteEventProvider docId={props.docId}>
      <Suspense>
        <NoteEventBody {...props} />
      </Suspense>
    </NoteEventProvider>
  </FeedsRefreshProvider>
);

const NoteEventBody: VoidComponent<SectionProps> = (props) => {
  const { event, removeEvent } = useNoteEvent();
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [open, setOpen] = createSignal(!props.hideWhenEmpty);
  // The menu item on a note that is already an event opens its details.
  createEffect(() => {
    if (!props.adding) return;
    setOpen(true);
    if (event()) props.onAddingDone?.();
  });
  const visible = () =>
    !props.hideWhenEmpty || event() !== null || props.adding === true;

  return (
    <Show when={visible()}>
      <Box
        as="section"
        aria-label="Event"
        class="not-prose"
        mb="2"
        pb={open() ? "3" : "1"}
        borderBottomWidth="1px"
        borderColor="border"
      >
        <Switch>
          <Match when={event() === null}>
            <AddEventDates
              startOpen={props.hideWhenEmpty}
              onClose={() => props.onAddingDone?.()}
            />
          </Match>
          <Match when={event()}>
            <Show when={event()}>
              {(e) => (
                <EventSummaryRow
                  event={e()}
                  open={open()}
                  onToggle={() => setOpen((value) => !value)}
                />
              )}
            </Show>
            <Show when={open() && event()}>
              {(e) => (
                <Box mt="2">
                  <EventDetailsForm />
                  <ShowsList />
                  <Box mt="3">
                    <Text
                      as="h3"
                      textStyle="xs"
                      fontWeight="semibold"
                      color="fg.muted"
                      mb="1.5"
                    >
                      Calendar feeds
                    </Text>
                    <EventFeedToggles eventId={e().id} />
                  </Box>
                  <Button
                    size="xs"
                    variant="plain"
                    colorPalette="gray"
                    color="fg.muted"
                    h="6"
                    px="1.5"
                    mt="2"
                    onClick={() => setConfirmOpen(true)}
                  >
                    Remove event
                  </Button>
                </Box>
              )}
            </Show>
            <ConfirmDialog
              open={confirmOpen()}
              onOpenChange={setConfirmOpen}
              title="Remove this event?"
              description="This deletes the event details and every show. The note stays."
              confirmLabel="Remove event"
              destructive
              onConfirm={() => void removeEvent()}
            />
          </Match>
        </Switch>
      </Box>
    </Show>
  );
};
