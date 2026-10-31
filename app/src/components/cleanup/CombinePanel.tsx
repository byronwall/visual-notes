import { useAction } from "@solidjs/router";
import {
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  on,
  untrack,
  type VoidComponent,
} from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import type { CleanupItemDetail } from "~/server/cleanup/queue";
import type { RegroupMember } from "~/server/cleanup/regroup-queue";
import {
  applyCombineAction,
  draftCombineForCluster,
} from "~/services/cleanup/cleanup.actions";
import { CleanupActionBar, paidLabel } from "./CleanupActionBar";
import { CombineMembers } from "./CombineMembers";
import { PanelSection } from "./PanelSection";
import { useOnDemand } from "./useOnDemand";

/**
 * Combine a cluster: choose the members and the note to keep; the LLM writes
 * what the others add (on request when that costs money), and approving
 * appends it and archives the rest into the kept note.
 */
export const CombinePanel: VoidComponent<{
  item: CleanupItemDetail;
  members: RegroupMember[];
  keeperId: string;
  onDone: () => void;
  onKeep: () => void;
  onSkip: () => void;
}> = (props) => {
  const apply = useAction(applyCombineAction);
  const [included, setIncluded] = createSignal(
    untrack(() => new Set(props.members.map((m) => m.docId))),
  );
  const [keepId, setKeepId] = createSignal<string | null>(
    untrack(() => props.keeperId),
  );
  const [newTitle, setNewTitle] = createSignal(untrack(() => props.item.title));
  const [editing, setEditing] = createSignal(false);
  const [markdown, setMarkdown] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const others = createMemo(() =>
    props.members
      .map((m) => m.docId)
      .filter((id) => included().has(id) && id !== keepId()),
  );
  const paid = () => props.item.paid.draft;
  const draft = useOnDemand({
    // Changing the members or the kept note asks for a new draft.
    key: () =>
      others().length
        ? JSON.stringify({ keepId: keepId(), otherIds: others() })
        : false,
    paid,
    run: (key) => draftCombineForCluster(JSON.parse(key)),
  });
  const latestDraft = draft.value;
  createEffect(
    on(
      () => latestDraft(),
      (d) => setMarkdown(d?.markdown ?? ""),
    ),
  );
  const needsDraft = () => others().length > 0 && !latestDraft() && !draft.loading();
  createEffect(
    on(
      () => props.item.docId,
      () => {
        setIncluded(new Set(props.members.map((m) => m.docId)));
        setKeepId(props.keeperId);
        setNewTitle(props.item.title);
        setEditing(false);
        setError(null);
      },
      { defer: true },
    ),
  );

  const toggle = (docId: string) => {
    const next = new Set(included());
    if (next.has(docId)) next.delete(docId);
    else next.add(docId);
    setIncluded(next);
  };
  const keepTitle = () =>
    props.members.find((m) => m.docId === keepId())?.title ?? newTitle();
  const memberIds = () =>
    props.members.map((m) => m.docId).filter((id) => included().has(id));

  const approve = async () => {
    if (busy() || !markdown().trim()) return;
    setBusy(true);
    setError(null);
    try {
      const keep = keepId();
      await apply({
        memberIds: memberIds(),
        markdown: markdown(),
        destination: keep
          ? { kind: "existing", docId: keep }
          : { kind: "new", title: newTitle(), path: props.item.path },
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
      <PanelSection title="Notes in this group">
        <CombineMembers
          members={props.members}
          included={included()}
          onToggle={toggle}
          keepId={keepId()}
          onKeep={setKeepId}
          newTitle={newTitle()}
          onNewTitle={setNewTitle}
        />
      </PanelSection>
      <PanelSection
        title={keepId() ? `Added to “${keepTitle()}”` : "New note content"}
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
                    ? "Local merge (no LLM key)"
                    : d().model}
                </Text>
              )}
            </Show>
            <Show when={latestDraft()}>
              <Button
                size="xs"
                variant="plain"
                onClick={() => setEditing((v) => !v)}
              >
                {editing() ? "Done editing" : "Edit"}
              </Button>
              <Button
                size="xs"
                variant="plain"
                onClick={draft.ask}
                disabled={draft.loading()}
              >
                {paid() ? paidLabel("Regenerate") : "Regenerate"}
              </Button>
            </Show>
          </HStack>
        }
      >
        <Switch
          fallback={
            <Stack gap="2" aria-busy="true" aria-label="Writing combined draft">
              <Skeleton h="4" w="90%" />
              <Skeleton h="4" w="70%" />
            </Stack>
          }
        >
          <Match when={draft.idle()}>
            <Text fontSize="xs" color="fg.muted">
              No draft yet. Writing one calls {props.item.paid.model}.
            </Text>
          </Match>
          <Match when={draft.failed()}>
            <Text fontSize="sm" color="fg.error">
              Couldn't write a draft. Try again.
            </Text>
          </Match>
          <Match when={latestDraft() || !others().length}>
            <Show
              when={editing()}
              fallback={
                <Box
                  fontSize="sm"
                  whiteSpace="pre-wrap"
                  maxH="22rem"
                  overflowY="auto"
                  color="fg.default"
                  data-testid="combine-preview"
                >
                  {markdown()}
                </Box>
              }
            >
              <Textarea
                aria-label="Combined markdown"
                minH="18rem"
                fontSize="sm"
                fontFamily="mono"
                value={markdown()}
                onInput={(e) => setMarkdown(e.currentTarget.value)}
              />
            </Show>
          </Match>
        </Switch>
      </PanelSection>
      <Show when={error()}>
        {(message) => (
          <Text fontSize="sm" color="fg.error">
            {message()}
          </Text>
        )}
      </Show>
      <CleanupActionBar
        primaryLabel={
          needsDraft()
            ? paid()
              ? paidLabel("Write draft")
              : "Write draft"
            : `Combine and archive ${others().length} ${others().length === 1 ? "note" : "notes"}`
        }
        onPrimary={needsDraft() ? draft.ask : approve}
        busy={busy()}
        disabled={
          !needsDraft() &&
          (!others().length || !markdown().trim() || draft.loading())
        }
        onKeep={props.onKeep}
        onSkip={props.onSkip}
      />
    </Stack>
  );
};
