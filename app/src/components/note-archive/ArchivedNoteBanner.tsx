import { A, useAction } from "@solidjs/router";
import { ArchiveIcon } from "lucide-solid";
import { Show, createSignal, type VoidComponent } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { button } from "styled-system/recipes";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import type { DocArchiveInfo } from "~/services/docs.queries";
import { restoreNoteAction } from "~/services/note-archive/note-archive.actions";
import { deletesInLabel, reasonVerb, shortDate } from "./archive-format";
import { inlineLink } from "./ArchivedNotesView";

/** Shown above an archived note: where it went, the countdown, and Restore. */
export const ArchivedNoteBanner: VoidComponent<{
  docId: string;
  archive: DocArchiveInfo;
}> = (props) => {
  const restore = useAction(restoreNoteAction);
  const [busy, setBusy] = createSignal(false);
  const onRestore = async () => {
    setBusy(true);
    try {
      await restore(props.docId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HStack
      data-testid="archived-note-banner"
      gap="3"
      px="3"
      py="2"
      mb="4"
      borderWidth="1px"
      borderColor="border"
      borderRadius="l2"
      bg="bg.subtle"
      flexWrap="wrap"
    >
      <Box color="fg.muted" display="flex" flexShrink="0">
        <ArchiveIcon size={16} />
      </Box>
      <Text fontSize="sm" color="fg.muted" flex="1" minW="0">
        Archived {shortDate(props.archive.archivedAt)} ·{" "}
        {reasonVerb(props.archive.reason)}
        <Show when={props.archive.into}>
          {(into) => (
            <>
              {" "}
              <A class={inlineLink} href={`/docs/${into().id}`}>
                {into().title}
              </A>
            </>
          )}
        </Show>{" "}
        · {deletesInLabel(props.archive.deletesAt)}
      </Text>
      <HStack gap="2">
        <Button
          size="xs"
          variant="outline"
          disabled={busy()}
          onClick={onRestore}
        >
          Restore
        </Button>
        <Show when={props.archive.into}>
          {(into) => (
            <A
              href={`/docs/${into().id}`}
              class={button({ size: "xs", variant: "solid" })}
            >
              Open{" "}
              {props.archive.reason === "combine" ? "combined" : "distilled"}{" "}
              note
            </A>
          )}
        </Show>
      </HStack>
    </HStack>
  );
};
