import { CheckIcon, PlusIcon } from "lucide-solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import {
  type TranscriptAnalysis,
  type TranscriptSegment,
  excerptSeconds,
  formatStamp,
} from "~/services/doc-audio/doc-audio.shared";

// Long memos yield 15+ tasks; the first few keep the transcript in view.
const COLLAPSED_COUNT = 5;

/**
 * Tasks from a transcript, each with an add button and, when its excerpt is
 * found in the raw text, the time it was said.
 */
export const DocAudioTasks = (props: {
  tasks: TranscriptAnalysis["tasks"];
  segments: TranscriptSegment[];
  onSeek: (seconds: number) => void;
  onAddTask?: (text: string) => void;
}) => {
  const [showAll, setShowAll] = createSignal(false);
  // Keyed by text so a redo with a different task list starts clean.
  const [added, setAdded] = createSignal<Set<string>>(new Set());
  const rows = createMemo(() =>
    props.tasks.map((task) => ({
      ...task,
      at: excerptSeconds(task.excerpt, props.segments),
    })),
  );
  const visible = () =>
    showAll() ? rows() : rows().slice(0, COLLAPSED_COUNT);
  const hidden = () => rows().length - COLLAPSED_COUNT;

  const addTask = (text: string) => {
    props.onAddTask?.(text);
    setAdded((prev) => new Set(prev).add(text));
  };

  return (
    <Stack gap="0">
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="1">
        Tasks · {rows().length}
      </Text>
      <For each={visible()}>
        {(task) => (
          <HStack gap="1" alignItems="flex-start" py="0.5">
            <Show when={props.onAddTask}>
              <IconButton
                size="2xs"
                variant="plain"
                flexShrink="0"
                ml="-1"
                mt="-0.5"
                color={added().has(task.text) ? "green.11" : "fg.muted"}
                aria-label={
                  added().has(task.text)
                    ? "Added as a task in the note"
                    : "Add as a task in the note"
                }
                disabled={added().has(task.text)}
                onClick={() => addTask(task.text)}
              >
                {added().has(task.text) ? (
                  <CheckIcon size={14} />
                ) : (
                  <PlusIcon size={14} />
                )}
              </IconButton>
            </Show>
            <Text fontSize="sm" lineHeight="1.25rem" flex="1" minW="0">
              {task.text}
            </Text>
            {/* Fixed width so times line up whether or not a row has one. */}
            <HStack w="12" flexShrink="0" justifyContent="flex-end">
              <Show when={task.at !== null}>
                <Button
                  size="2xs"
                  variant="plain"
                  px="1"
                  h="5"
                  mr="-1"
                  color="fg.muted"
                  fontWeight="normal"
                  fontVariantNumeric="tabular-nums"
                aria-label={`Play where this was said, ${formatStamp(task.at!)}`}
                onClick={() => props.onSeek(task.at!)}
              >
                  {formatStamp(task.at!)}
                </Button>
              </Show>
            </HStack>
          </HStack>
        )}
      </For>
      <Show when={hidden() > 0}>
        <Button
          size="2xs"
          variant="plain"
          alignSelf="flex-start"
          // Under the task text, past the add buttons.
          ml={props.onAddTask ? "6" : "0"}
          px="0"
          color="fg.muted"
          onClick={() => setShowAll(!showAll())}
        >
          {showAll() ? "Show fewer tasks" : `Show ${hidden()} more tasks`}
        </Button>
      </Show>
    </Stack>
  );
};
