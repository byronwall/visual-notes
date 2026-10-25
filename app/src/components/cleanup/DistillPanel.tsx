import { useAction } from "@solidjs/router";
import {
  Show,
  createEffect,
  createResource,
  createSignal,
  on,
  onMount,
  untrack,
  type VoidComponent,
} from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Text } from "~/components/ui/text";
import type { CleanupItemDetail } from "~/server/cleanup/queue";
import {
  applyDistillAction,
  archiveOnlyAction,
  draftDistillForNote,
} from "~/services/cleanup/cleanup.actions";
import { CleanupActionBar } from "./CleanupActionBar";
import { DestinationPicker, type DestinationChoice } from "./DestinationPicker";
import { DistillReview } from "./DistillReview";
import { DraftPreview } from "./DraftPreview";
import { PanelSection } from "./PanelSection";

const defaultDestination = (
  item: CleanupItemDetail,
  title: string,
): DestinationChoice =>
  item.destinations[0]
    ? {
        kind: "existing",
        docId: item.destinations[0].docId,
        title: item.destinations[0].title,
      }
    : { kind: "new", title, path: item.path };

/**
 * Distill one note: an LLM draft written on demand, where to send it, and
 * approve (which archives the original). Review opens the side-by-side edit.
 */
export const DistillPanel: VoidComponent<{
  item: CleanupItemDetail;
  onDone: () => void;
  onKeep: () => void;
  onSkip: () => void;
  /** post_event keeps only the reusable part of a passed event. */
  mode?: "distill" | "post_event";
}> = (props) => {
  const apply = useAction(applyDistillAction);
  const archiveOnly = useAction(archiveOnlyAction);
  const mode = () => props.mode ?? "distill";
  // Drafting calls an LLM, so it runs only in the browser once the note is
  // selected: never during SSR, and never for a note nobody opened.
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));
  const [draft, { refetch }] = createResource(
    () => (mounted() ? { id: props.item.docId, mode: mode() } : false),
    (key) => draftDistillForNote(key.id, key.mode),
  );
  // A failed draft must not throw out of the page: read the value only when
  // the resource has not errored.
  const latestDraft = () => (draft.error ? undefined : draft.latest);
  const [markdown, setMarkdown] = createSignal("");
  // Seeded from the first item; the effect below resets it per note.
  const [destination, setDestination] = createSignal<DestinationChoice>(
    untrack(() => defaultDestination(props.item, "")),
  );
  const [reviewing, setReviewing] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(
    on(
      () => latestDraft(),
      (next) => {
        if (!next) return;
        setMarkdown(next.markdown);
        const dest = destination();
        if (dest.kind === "new" && !dest.title) {
          setDestination({ ...dest, title: next.title });
        }
      },
    ),
  );
  createEffect(
    on(
      () => props.item.docId,
      () => {
        setDestination(defaultDestination(props.item, ""));
        setReviewing(false);
        setError(null);
      },
      { defer: true },
    ),
  );

  const archiveWithoutKeeping = async () => {
    await archiveOnly({ docId: props.item.docId, reason: "post_event" });
    props.onDone();
  };

  const approve = async () => {
    const dest = destination();
    if (!markdown().trim() || busy()) return;
    setBusy(true);
    setError(null);
    try {
      await apply({
        reason: mode(),
        docId: props.item.docId,
        markdown: markdown(),
        destination:
          dest.kind === "new"
            ? {
                kind: "new",
                title: dest.title || props.item.title,
                path: dest.path,
              }
            : { kind: "existing", docId: dest.docId },
      });
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="4" flex="1" minH="0">
      <Show
        when={!reviewing()}
        fallback={
          <DistillReview
            original={props.item.markdown}
            markdown={markdown()}
            onMarkdown={setMarkdown}
          />
        }
      >
        <PanelSection
          title={mode() === "post_event" ? "Keep for next time" : "Proposed"}
          aside={
            <HStack gap="1">
              <Show when={latestDraft()}>
                {(d) => (
                  <Text
                    fontSize="xs"
                    color="fg.subtle"
                    display={{ base: "none", sm: "block" }}
                  >
                    {d().model === "local-extract"
                      ? "Local extract (no LLM key)"
                      : d().model}
                  </Text>
                )}
              </Show>
              <Button
                size="xs"
                variant="plain"
                onClick={() => setReviewing(true)}
              >
                Review and edit
              </Button>
              <Button
                size="xs"
                variant="plain"
                onClick={() => refetch()}
                disabled={draft.loading}
              >
                Regenerate
              </Button>
            </HStack>
          }
        >
          <Show
            when={mounted() && (!draft.loading || latestDraft())}
            fallback={
              <Stack gap="2" aria-busy="true" aria-label="Writing draft">
                <Skeleton h="4" w="90%" />
                <Skeleton h="4" w="75%" />
                <Skeleton h="4" w="82%" />
              </Stack>
            }
          >
            <Show
              when={!draft.error}
              fallback={
                <Text fontSize="sm" color="fg.error">
                  Couldn't write a draft. Try Regenerate.
                </Text>
              }
            >
              <DraftPreview markdown={markdown()} />
            </Show>
          </Show>
        </PanelSection>
      </Show>
      <PanelSection title="Send to">
        <DestinationPicker
          path={props.item.path}
          options={props.item.destinations}
          value={destination()}
          onChange={setDestination}
        />
      </PanelSection>
      <Show when={reviewing()}>
        <Box>
          <Button size="xs" variant="plain" onClick={() => setReviewing(false)}>
            Back to summary
          </Button>
        </Box>
      </Show>
      <Show when={mode() === "post_event"}>
        <Box>
          <Button
            size="xs"
            variant="plain"
            onClick={() => void archiveWithoutKeeping()}
          >
            Archive without keeping anything
          </Button>
        </Box>
      </Show>
      <Show when={error()}>
        {(message) => (
          <Text fontSize="sm" color="fg.error">
            {message()}
          </Text>
        )}
      </Show>
      <CleanupActionBar
        primaryLabel={
          mode() === "post_event"
            ? "Summarize and archive"
            : "Distill and archive original"
        }
        onPrimary={approve}
        busy={busy()}
        disabled={!markdown().trim() || !mounted() || draft.loading}
        onKeep={props.onKeep}
        onSkip={props.onSkip}
      />
    </Stack>
  );
};
