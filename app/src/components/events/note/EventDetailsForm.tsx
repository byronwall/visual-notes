import { ExternalLinkIcon } from "lucide-solid";
import { Show, type JSX, type VoidComponent } from "solid-js";
import { Box, Grid, HStack } from "styled-system/jsx";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { CommitField } from "./CommitField";
import { DecisionSelect } from "./DecisionSelect";
import { useNoteEvent } from "./NoteEventContext";
import { PlacePicker } from "./PlacePicker";

export const FieldRow = (props: { label: string; children: JSX.Element }) => (
  <>
    <Text textStyle="xs" color="fg.muted" pt="1.5" lineHeight="1.4">
      {props.label}
    </Text>
    <Box minW="0">{props.children}</Box>
  </>
);

/** Event-level fields: official link, summary, default place, decision. */
export const EventDetailsForm: VoidComponent = () => {
  const { event, saveEvent } = useNoteEvent();
  const ev = () => event()!;

  return (
    <Grid
      gridTemplateColumns="5.5rem minmax(0, 1fr)"
      columnGap="2"
      rowGap="1.5"
    >
      <FieldRow label="Official link">
        <HStack gap="1">
          <Box flex="1" minW="0">
            <CommitField
              type="url"
              aria-label="Official link"
              placeholder="https://"
              value={ev().url}
              onCommit={(url) => void saveEvent({ url: url || null })}
            />
          </Box>
          <Show when={ev().url}>
            {(url) => (
              <Link
                href={url()}
                target="_blank"
                rel="noreferrer"
                aria-label="Open official link"
                color="fg.muted"
                display="inline-flex"
                p="1"
              >
                <ExternalLinkIcon size={13} />
              </Link>
            )}
          </Show>
        </HStack>
      </FieldRow>
      <FieldRow label="Summary">
        <CommitField
          multiline
          aria-label="Summary"
          placeholder="One or two lines for calendar entries"
          value={ev().summary}
          onCommit={(summary) => void saveEvent({ summary: summary || null })}
        />
      </FieldRow>
      <FieldRow label="Place">
        <PlacePicker
          place={ev().place}
          onChange={(place) => void saveEvent({ placeId: place?.id ?? null })}
        />
      </FieldRow>
      <FieldRow label="Decision">
        <Grid gridTemplateColumns="auto minmax(0, 1fr)" gap="1.5">
          <DecisionSelect
            value={ev().decision}
            onChange={(decision) => void saveEvent({ decision })}
          />
          <CommitField
            aria-label="Decision note"
            placeholder="Why? (optional)"
            value={ev().decisionNote}
            onCommit={(note) => void saveEvent({ decisionNote: note || null })}
          />
        </Grid>
      </FieldRow>
    </Grid>
  );
};
