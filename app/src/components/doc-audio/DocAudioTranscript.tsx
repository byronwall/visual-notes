import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  TextQuoteIcon,
} from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import * as SegmentGroup from "~/components/ui/segment-group";
import { Text } from "~/components/ui/text";
import {
  type TranscriptAnalysis,
  type TranscriptSegment,
  transcriptMarkdown,
  verbatimMarkdown,
} from "~/services/doc-audio/doc-audio.shared";
import { DocAudioTasks } from "./DocAudioTasks";
import { type TranscriptMode, TranscriptSections } from "./TranscriptSections";

const wordCount = (segments: TranscriptSegment[]) =>
  segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);

/**
 * A finished transcript under its recording: summary and tasks always, then
 * the sections behind a toggle in summary or raw (verbatim) form. Copy and
 * Insert act on the form that is showing.
 */
export const DocAudioTranscript = (props: {
  analysis: TranscriptAnalysis;
  segments: TranscriptSegment[];
  time: number | null;
  playing: boolean;
  onSeek: (seconds: number) => void;
  onInsert?: (mode: TranscriptMode) => void;
  onAddTask?: (text: string) => void;
}) => {
  const [open, setOpen] = createSignal(false);
  const [mode, setMode] = createSignal<TranscriptMode>("summary");
  const [copied, setCopied] = createSignal(false);
  const hasRaw = () => props.segments.length > 0;

  const pickMode = (value: TranscriptMode) => {
    setMode(value);
    setOpen(true);
  };

  const copy = async () => {
    const text =
      mode() === "raw"
        ? verbatimMarkdown(props.analysis, props.segments)
        : transcriptMarkdown(props.analysis);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Stack gap="2" pt="1" data-testid="doc-audio-transcript">
      <Text fontSize="sm" color="fg.default" lineHeight="relaxed">
        {props.analysis.summary}
      </Text>
      <Show when={props.analysis.tasks.length > 0}>
        <DocAudioTasks
          tasks={props.analysis.tasks}
          segments={props.segments}
          onSeek={(seconds) => {
            // Show the exact words being played, not just the audio.
            pickMode("raw");
            props.onSeek(seconds);
          }}
          onAddTask={props.onAddTask}
        />
      </Show>
      <HStack gap="2" justifyContent="space-between" flexWrap="wrap">
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
          <Show when={hasRaw()}>
            {" "}
            · {wordCount(props.segments).toLocaleString()} words
          </Show>
        </Button>
        <HStack gap="1">
          <Show when={hasRaw()}>
            <SegmentGroup.Root
              size="xs"
              value={mode()}
              aria-label="Transcript form"
              onValueChange={(d) => pickMode(d.value as TranscriptMode)}
            >
              <SegmentGroup.Indicator />
              <SegmentGroup.Item value="summary" h="6" px="2" textStyle="xs">
                <SegmentGroup.ItemText>Summary</SegmentGroup.ItemText>
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
              <SegmentGroup.Item value="raw" h="6" px="2" textStyle="xs">
                <SegmentGroup.ItemText>Raw</SegmentGroup.ItemText>
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
            </SegmentGroup.Root>
          </Show>
          <IconButton
            size="xs"
            variant="plain"
            aria-label={
              mode() === "raw" ? "Copy raw transcript" : "Copy transcript"
            }
            title={mode() === "raw" ? "Copy raw transcript" : "Copy transcript"}
            onClick={() => void copy()}
          >
            {copied() ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          </IconButton>
          <Show when={props.onInsert}>
            <Button
              size="xs"
              variant="plain"
              onClick={() => props.onInsert?.(mode())}
            >
              <TextQuoteIcon size={12} />
              Insert into note
            </Button>
          </Show>
        </HStack>
      </HStack>
      <Show when={open()}>
        <TranscriptSections
          analysis={props.analysis}
          segments={props.segments}
          mode={mode()}
          time={props.time}
          playing={props.playing}
          onSeek={props.onSeek}
        />
      </Show>
    </Stack>
  );
};
