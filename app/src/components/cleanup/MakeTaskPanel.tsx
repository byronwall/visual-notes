import { useAction } from "@solidjs/router";
import { CircleCheckIcon, XIcon } from "lucide-solid";
import {
  For,
  Index,
  Show,
  createEffect,
  createSignal,
  on,
  type VoidComponent,
} from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import type { CleanupItemDetail } from "~/server/cleanup/queue";
import { makeTaskAction } from "~/services/cleanup/cleanup.actions";
import { CleanupActionBar } from "./CleanupActionBar";
import { PanelSection } from "./PanelSection";

/** Turn a to-do note into Inbox tasks, then archive the note. */
export const MakeTaskPanel: VoidComponent<{
  item: CleanupItemDetail;
  onDone: () => void;
  onKeep: () => void;
  onSkip: () => void;
}> = (props) => {
  const makeTasks = useAction(makeTaskAction);
  const [drafts, setDrafts] = createSignal<string[]>([]);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  createEffect(
    on(
      () => props.item.docId,
      () => {
        setDrafts([...(props.item.tasks?.suggested ?? [])]);
        setError(null);
      },
    ),
  );
  const existing = () => props.item.tasks?.existing ?? [];
  const toCreate = () =>
    drafts()
      .map((d) => d.trim())
      .filter(Boolean);
  const label = () => {
    const n = toCreate().length;
    if (!n) return "Archive note (tasks stay)";
    return `Create ${n} ${n === 1 ? "task" : "tasks"} and archive note`;
  };

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      await makeTasks({ docId: props.item.docId, descriptions: toCreate() });
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="4" flex="1" minH="0">
      <Show when={existing().length}>
        <PanelSection title="Already tasks">
          <Stack gap="1.5">
            <For each={existing()}>
              {(task) => (
                <HStack gap="2" fontSize="sm">
                  <Box color="fg.muted" display="flex">
                    <CircleCheckIcon size={14} />
                  </Box>
                  <Text as="span">{task.description}</Text>
                </HStack>
              )}
            </For>
            <Text fontSize="xs" color="fg.muted">
              These checkboxes are already in your Inbox. They stay there when
              the note is archived.
            </Text>
          </Stack>
        </PanelSection>
      </Show>
      <PanelSection
        title="New tasks in Inbox"
        aside={
          <Button
            size="xs"
            variant="plain"
            onClick={() => setDrafts([...drafts(), ""])}
          >
            Add task
          </Button>
        }
      >
        <Stack gap="1.5" data-testid="task-drafts">
          <Index each={drafts()}>
            {(draft, index) => (
              <HStack gap="1.5">
                <Input
                  size="sm"
                  aria-label={`Task ${index + 1}`}
                  value={draft()}
                  onInput={(e) => {
                    const next = [...drafts()];
                    next[index] = e.currentTarget.value;
                    setDrafts(next);
                  }}
                />
                <IconButton
                  size="xs"
                  variant="plain"
                  aria-label="Remove task"
                  onClick={() =>
                    setDrafts(drafts().filter((_, i) => i !== index))
                  }
                >
                  <XIcon size={14} />
                </IconButton>
              </HStack>
            )}
          </Index>
          <Show when={!drafts().length}>
            <Text fontSize="sm" color="fg.muted">
              No new tasks.
            </Text>
          </Show>
        </Stack>
      </PanelSection>
      <Show when={error()}>
        {(message) => (
          <Text fontSize="sm" color="fg.error">
            {message()}
          </Text>
        )}
      </Show>
      <CleanupActionBar
        primaryLabel={label()}
        onPrimary={approve}
        busy={busy()}
        onKeep={props.onKeep}
        onSkip={props.onSkip}
      />
    </Stack>
  );
};
