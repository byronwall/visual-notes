import {
  CheckIcon,
  ChevronRightIcon,
  PlusIcon,
  TextQuoteIcon,
} from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import {
  type TranscriptAnalysis,
  formatStamp,
  stampSeconds,
} from "~/services/doc-audio/doc-audio.shared";

/**
 * A finished transcript under its recording: summary always, tasks with an
 * add button each, and the cleaned sections behind a toggle. Clicking a
 * section's time seeks the player.
 */
export const DocAudioTranscript = (props: {
  analysis: TranscriptAnalysis;
  onSeek: (seconds: number) => void;
  onInsert?: () => void;
  onAddTask?: (text: string) => void;
}) => {
  const [open, setOpen] = createSignal(false);
  const [added, setAdded] = createSignal<Set<number>>(new Set());

  const addTask = (index: number, text: string) => {
    props.onAddTask?.(text);
    setAdded((prev) => new Set(prev).add(index));
  };

  return (
    <Stack gap="2" pt="1" data-testid="doc-audio-transcript">
      <Text fontSize="sm" color="fg.default" lineHeight="relaxed">
        {props.analysis.summary}
      </Text>
      <Show when={props.analysis.tasks.length > 0}>
        <Stack gap="1">
          <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
            Tasks
          </Text>
          <For each={props.analysis.tasks}>
            {(task, index) => (
              <HStack gap="1.5" alignItems="flex-start">
                <Show when={props.onAddTask}>
                  <IconButton
                    size="2xs"
                    variant="plain"
                    flexShrink="0"
                    mt="-0.5"
                    aria-label={
                      added().has(index())
                        ? "Added as a task in the note"
                        : "Add as a task in the note"
                    }
                    title={
                      added().has(index())
                        ? "Added to the note"
                        : "Add as a task in the note"
                    }
                    disabled={added().has(index())}
                    onClick={() => addTask(index(), task.text)}
                  >
                    {added().has(index()) ? (
                      <CheckIcon size={14} />
                    ) : (
                      <PlusIcon size={14} />
                    )}
                  </IconButton>
                </Show>
                <Text fontSize="sm" flex="1" minW="0" title={task.excerpt}>
                  {task.text}
                </Text>
              </HStack>
            )}
          </For>
        </Stack>
      </Show>
      <HStack gap="2" justifyContent="space-between">
        <Button
          size="xs"
          variant="plain"
          px="0"
          aria-expanded={open()}
          onClick={() => setOpen(!open())}
        >
          <Box
            as="span"
            display="inline-flex"
            transition="transform 0.15s"
            style={{ transform: open() ? "rotate(90deg)" : "none" }}
          >
            <ChevronRightIcon size={14} />
          </Box>
          Transcript · {props.analysis.sections.length} sections
        </Button>
        <Show when={props.onInsert}>
          <Button size="xs" variant="plain" onClick={() => props.onInsert?.()}>
            <TextQuoteIcon size={12} />
            Insert into note
          </Button>
        </Show>
      </HStack>
      <Show when={open()}>
        <Stack gap="3" borderLeftWidth="2px" borderColor="border" pl="3">
          <For each={props.analysis.sections}>
            {(section) => (
              <Stack gap="0.5">
                <HStack gap="2" alignItems="baseline">
                  <Button
                    size="xs"
                    variant="plain"
                    px="0"
                    h="auto"
                    color="fg.muted"
                    fontVariantNumeric="tabular-nums"
                    aria-label={`Play from ${formatStamp(stampSeconds(section.start))}`}
                    onClick={() => props.onSeek(stampSeconds(section.start))}
                  >
                    {formatStamp(stampSeconds(section.start))}
                  </Button>
                  <Text fontSize="sm" fontWeight="medium">
                    {section.title}
                  </Text>
                </HStack>
                <Text fontSize="sm" color="fg.muted" lineHeight="relaxed">
                  {section.cleanedText}
                </Text>
              </Stack>
            )}
          </For>
        </Stack>
      </Show>
    </Stack>
  );
};
