import { CalendarDaysIcon } from "lucide-solid";
import {
  Match,
  Suspense,
  Switch,
  createSignal,
  type VoidComponent,
} from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Text } from "~/components/ui/text";
import { AddEventDates } from "./AddEventDates";
import { EventDetailsForm } from "./EventDetailsForm";
import { NoteEventProvider, useNoteEvent } from "./NoteEventContext";
import { ShowsList } from "./ShowsList";

/** The note side panel's "Event" section: details, shows, and repeats. */
export const NoteEventSection: VoidComponent<{ docId: string }> = (props) => (
  <NoteEventProvider docId={props.docId}>
    <Suspense>
      <NoteEventBody />
    </Suspense>
  </NoteEventProvider>
);

const NoteEventBody: VoidComponent = () => {
  const { event, removeEvent } = useNoteEvent();
  const [confirmOpen, setConfirmOpen] = createSignal(false);

  return (
    <Box
      as="section"
      aria-label="Event"
      class="not-prose"
      mb="3"
      pb="3"
      borderBottomWidth="1px"
      borderColor="border"
    >
      <Switch>
        <Match when={event() === null}>
          <AddEventDates />
        </Match>
        <Match when={event()}>
          <HStack justify="space-between" gap="2" mb="2">
            <HStack gap="1.5" color="fg.muted">
              <CalendarDaysIcon size={14} />
              <Text
                as="h2"
                textStyle="xs"
                fontWeight="semibold"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                Event
              </Text>
            </HStack>
            <Button
              size="xs"
              variant="plain"
              colorPalette="gray"
              color="fg.muted"
              h="6"
              px="1.5"
              onClick={() => setConfirmOpen(true)}
            >
              Remove event
            </Button>
          </HStack>
          <EventDetailsForm />
          <ShowsList />
          {/* feed toggles mount here (events/2-feeds EventFeedToggles) */}
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
  );
};
