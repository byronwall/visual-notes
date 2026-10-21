import { PencilIcon, Trash2Icon } from "lucide-solid";
import { Show, createSignal, onCleanup, type VoidComponent } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { formatShowWhen } from "~/lib/events/format";
import { STATUS_LABELS, type Occurrence } from "~/lib/events/types";
import { DecisionSelect } from "./DecisionSelect";
import { useNoteEvent } from "./NoteEventContext";
import { draftFromShow } from "./show-draft";
import { ShowEditorDialog } from "./ShowEditorDialog";

const STATUS_PALETTE = {
  scheduled: "gray",
  cancelled: "red",
  postponed: "orange",
  sold_out: "amber",
} as const;

/** One show: when, status, place override, decision, edit and delete. */
export const ShowRow: VoidComponent<{ show: Occurrence }> = (props) => {
  const { event, saveShow, removeShow } = useNoteEvent();
  const [editing, setEditing] = createSignal(false);
  const [confirming, setConfirming] = createSignal(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(resetTimer));

  const currentYear = new Date().getFullYear();
  const otherPlace = () => {
    const place = props.show.place;
    return place && place.id !== event()?.placeId ? place : null;
  };
  const details = () =>
    [props.show.label, otherPlace()?.name, props.show.ticketStatus]
      .filter(Boolean)
      .join(" · ");

  const onDelete = () => {
    if (!confirming()) {
      setConfirming(true);
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    void removeShow(props.show.id);
  };

  return (
    <HStack
      gap="1.5"
      py="1"
      px="1"
      borderRadius="l2"
      _hover={{ bg: "gray.a2" }}
      data-show-id={props.show.id}
    >
      <Box flex="1" minW="0">
        <HStack gap="1.5" rowGap="0" minW="0" flexWrap="wrap">
          <Text
            textStyle="sm"
            textDecoration={
              props.show.status === "cancelled" ? "line-through" : undefined
            }
          >
            {formatShowWhen(props.show, currentYear)}
          </Text>
          <Show when={props.show.status !== "scheduled"}>
            <Badge
              size="sm"
              variant="subtle"
              colorPalette={STATUS_PALETTE[props.show.status]}
              flexShrink="0"
            >
              {STATUS_LABELS[props.show.status]}
            </Badge>
          </Show>
        </HStack>
        <Show when={details()}>
          <Text textStyle="xs" color="fg.muted" truncate>
            {details()}
          </Text>
        </Show>
      </Box>
      {/* Select roots fill their parent; pin the width so the text keeps room. */}
      <Box w="28" flexShrink="0">
        <DecisionSelect
          value={props.show.decision}
          unreviewedLabel="As event"
          minW="0"
          onChange={(decision) => void saveShow(props.show.id, { decision })}
        />
      </Box>
      <IconButton
        size="xs"
        variant="plain"
        colorPalette="gray"
        aria-label="Edit show"
        onClick={() => setEditing(true)}
      >
        <PencilIcon size={13} />
      </IconButton>
      <Show
        when={confirming()}
        fallback={
          <IconButton
            size="xs"
            variant="plain"
            colorPalette="gray"
            aria-label="Delete show"
            onClick={onDelete}
          >
            <Trash2Icon size={13} />
          </IconButton>
        }
      >
        <Button
          size="xs"
          variant="subtle"
          colorPalette="red"
          px="2"
          onClick={onDelete}
        >
          Delete?
        </Button>
      </Show>
      {/* Mounted only while editing so long show lists stay light. */}
      <Show when={editing()}>
        <ShowEditorDialog
          open
          title="Edit show"
          initial={draftFromShow(props.show)}
          submitLabel="Save show"
          onClose={() => setEditing(false)}
          onSubmit={(input) => saveShow(props.show.id, input)}
        />
      </Show>
    </HStack>
  );
};
