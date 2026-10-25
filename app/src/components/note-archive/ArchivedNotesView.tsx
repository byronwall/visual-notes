import { A, createAsync, useAction } from "@solidjs/router";
import { For, Show, createSignal, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import { restoreNoteAction } from "~/services/note-archive/note-archive.actions";
import {
  fetchArchivedNotes,
  type ArchivedNote,
} from "~/services/note-archive/note-archive.queries";
import {
  daysUntil,
  deletesInLabel,
  reasonVerb,
  shortDate,
} from "./archive-format";

const SOON_DAYS = 3;
const titleLink = css({ display: "block", py: "1", minW: "0" });
export const inlineLink = css({
  color: "fg.default",
  textDecoration: "underline",
  textDecorationColor: "border",
  textUnderlineOffset: "2px",
  _hover: { textDecorationColor: "fg.muted" },
});

const ArchivedRow: VoidComponent<{ note: ArchivedNote }> = (props) => {
  const restore = useAction(restoreNoteAction);
  const [busy, setBusy] = createSignal(false);
  const soon = () => daysUntil(props.note.deletesAt) <= SOON_DAYS;
  const onRestore = async () => {
    setBusy(true);
    try {
      await restore(props.note.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HStack
      data-testid="archived-note-row"
      gap="4"
      px="3"
      py="2.5"
      borderBottomWidth="1px"
      borderColor="border"
      _last={{ borderBottomWidth: "0" }}
    >
      <Stack gap="0.5" flex="1" minW="0">
        <A href={`/docs/${props.note.id}`} class={titleLink}>
          <Text truncate fontSize="sm" fontWeight="medium">
            {props.note.title || "Untitled note"}
          </Text>
        </A>
        <Text
          fontSize="xs"
          display={{ base: "block", md: "none" }}
          color={soon() ? "red.11" : "fg.muted"}
        >
          {deletesInLabel(props.note.deletesAt)}
        </Text>
        <Text fontSize="xs" color="fg.muted" truncate>
          {props.note.path || "Unfiled"} · archived{" "}
          {shortDate(props.note.archivedAt)} · {reasonVerb(props.note.reason)}
          <Show when={props.note.into}>
            {(into) => (
              <>
                {" "}
                <A class={inlineLink} href={`/docs/${into().id}`}>
                  {into().title}
                </A>
              </>
            )}
          </Show>
        </Text>
      </Stack>
      <Text
        fontSize="xs"
        flexShrink="0"
        display={{ base: "none", md: "block" }}
        color={soon() ? "red.11" : "fg.muted"}
        fontWeight={soon() ? "medium" : "normal"}
      >
        {deletesInLabel(props.note.deletesAt)}
      </Text>
      <Button
        size="xs"
        variant="outline"
        flexShrink="0"
        disabled={busy()}
        onClick={onRestore}
      >
        Restore
      </Button>
    </HStack>
  );
};

/** Every archived note, soonest deletion first, with Restore. */
export const ArchivedNotesView: VoidComponent = () => {
  const data = createAsync(() => fetchArchivedNotes());

  return (
    <Stack gap="4" maxW="4xl" w="full" mx="auto">
      <Stack gap="1">
        <Heading as="h1" fontSize="xl">
          Archived notes
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          Archived notes are hidden from search, lists, and the path tree. Links
          to them open the note their content went into. Each one is deleted{" "}
          {data()?.retentionDays ?? 30} days after it was archived.
        </Text>
      </Stack>
      <Show
        when={data()?.notes.length}
        fallback={
          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="l2"
            px="4"
            py="8"
            textAlign="center"
          >
            <Text fontSize="sm" color="fg.muted">
              Nothing is archived.
            </Text>
          </Box>
        }
      >
        <Box
          borderWidth="1px"
          borderColor="border"
          borderRadius="l2"
          bg="bg.default"
        >
          <For each={data()?.notes}>
            {(note) => <ArchivedRow note={note} />}
          </For>
        </Box>
      </Show>
    </Stack>
  );
};
