import { useAction } from "@solidjs/router";
import { Show, createSignal, type VoidComponent } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import type { CleanupItemDetail } from "~/server/cleanup/queue";
import { archiveOnlyAction } from "~/services/cleanup/cleanup.actions";
import { CleanupActionBar } from "./CleanupActionBar";
import { PanelSection } from "./PanelSection";

const PREVIEW_CHARS = 900;

/**
 * Delete, or a passed event with nothing reusable: show what the note holds
 * and archive it. The archive deletes it after 30 days.
 */
export const ArchiveOnlyPanel: VoidComponent<{
  item: CleanupItemDetail;
  reason: "delete" | "post_event";
  onDone: () => void;
  onKeep: () => void;
  onSkip: () => void;
}> = (props) => {
  const archive = useAction(archiveOnlyAction);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const text = () =>
    props.item.markdown.replace(/\s*\^[\w-]{6,}\s*$/gm, "").trim();

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      await archive({ docId: props.item.docId, reason: props.reason });
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="4" flex="1" minH="0">
      <PanelSection
        title={
          props.reason === "delete" ? "What it holds" : "Nothing reusable found"
        }
      >
        <Show
          when={text()}
          fallback={
            <Text fontSize="sm" color="fg.muted">
              This note is empty.
            </Text>
          }
        >
          <Box
            data-testid="archive-preview"
            fontSize="sm"
            color="fg.muted"
            whiteSpace="pre-wrap"
            maxH="20rem"
            overflowY="auto"
          >
            {text().length > PREVIEW_CHARS
              ? `${text().slice(0, PREVIEW_CHARS)}…`
              : text()}
          </Box>
        </Show>
      </PanelSection>
      <Text fontSize="xs" color="fg.muted">
        Archiving hides it now; it is deleted after 30 days unless you restore
        it.
      </Text>
      <Show when={error()}>
        {(message) => (
          <Text fontSize="sm" color="fg.error">
            {message()}
          </Text>
        )}
      </Show>
      <CleanupActionBar
        primaryLabel="Archive"
        onPrimary={approve}
        busy={busy()}
        onKeep={props.onKeep}
        onSkip={props.onSkip}
      />
    </Stack>
  );
};
