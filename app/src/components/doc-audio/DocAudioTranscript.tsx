import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  TextQuoteIcon,
} from "lucide-solid";
import { type JSX, Show, createSignal, onMount } from "solid-js";
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

const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

// One choice for every recording, remembered per viewer.
const MODE_KEY = "vn.transcript-mode";
const [mode, setMode] = createSignal<TranscriptMode>("summary");

/** Cross-fades between an idle icon and a confirmation, in place. */
const SwapIcon = (props: { on: boolean; idle: JSX.Element; done: JSX.Element }) => (
  <Box as="span" position="relative" display="inline-flex" boxSize="3.5">
    <Box
      as="span"
      position="absolute"
      inset="0"
      display="inline-flex"
      transition="opacity 0.14s, transform 0.14s"
      style={{ opacity: props.on ? 0 : 1, transform: props.on ? "scale(0.6)" : "none" }}
    >
      {props.idle}
    </Box>
    <Box
      as="span"
      position="absolute"
      inset="0"
      display="inline-flex"
      color="green.11"
      transition="opacity 0.14s, transform 0.14s"
      style={{ opacity: props.on ? 1 : 0, transform: props.on ? "none" : "scale(0.6)" }}
    >
      {props.done}
    </Box>
  </Box>
);

/** A flag that turns itself off after a moment. */
const flash = () => {
  const [on, setOn] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  return [
    on,
    () => {
      setOn(true);
      clearTimeout(timer);
      timer = setTimeout(() => setOn(false), 1500);
    },
  ] as const;
};

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
  const [copied, flashCopied] = flash();
  const [inserted, flashInserted] = flash();
  const [copyFailed, setCopyFailed] = createSignal(false);
  const hasRaw = () => props.segments.length > 0;
  // Without raw segments there is only the summary form.
  const shown = (): TranscriptMode => (hasRaw() ? mode() : "summary");
  const formName = () => (shown() === "raw" ? "raw transcript" : "transcript");

  onMount(() => {
    try {
      if (localStorage.getItem(MODE_KEY) === "raw") setMode("raw");
    } catch {
      // Storage can be blocked; the default form is fine.
    }
  });

  const pickMode = (value: TranscriptMode) => {
    setMode(value);
    setOpen(true);
    try {
      localStorage.setItem(MODE_KEY, value);
    } catch {
      // Not remembered this time.
    }
  };

  const copy = async () => {
    const text =
      shown() === "raw"
        ? verbatimMarkdown(props.analysis, props.segments)
        : transcriptMarkdown(props.analysis);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      flashCopied();
    } catch (err) {
      console.warn("[doc-audio] copy failed", err);
      setCopyFailed(true);
    }
  };

  const insert = () => {
    props.onInsert?.(shown());
    flashInserted();
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
      <HStack
        gap="2"
        rowGap="1"
        justifyContent="space-between"
        flexWrap="wrap"
        minH="6"
      >
        <Button
          size="2xs"
          variant="plain"
          px="0"
          ml="-0.5"
          color="fg.muted"
          fontWeight="semibold"
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
          Transcript · {plural(props.analysis.sections.length, "section")}
          <Show when={hasRaw()}>
            {" "}
            · {plural(wordCount(props.segments), "word")}
          </Show>
        </Button>
        <HStack gap="1" alignItems="center">
          <Show when={hasRaw()}>
            <SegmentGroup.Root
              size="xs"
              value={shown()}
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
            size="2xs"
            variant="plain"
            color={copyFailed() ? "red.11" : "fg.muted"}
            aria-label={
              copyFailed()
                ? `Copy failed; try again to copy the ${formName()}`
                : `Copy ${formName()}`
            }
            onClick={() => void copy()}
          >
            <SwapIcon
              on={copied()}
              idle={<CopyIcon size={14} />}
              done={<CheckIcon size={14} />}
            />
          </IconButton>
          <Show when={props.onInsert}>
            <Button
              size="2xs"
              variant="plain"
              color="fg.muted"
              aria-label={`Insert the ${formName()} into the note`}
              onClick={insert}
            >
              <SwapIcon
                on={inserted()}
                idle={<TextQuoteIcon size={14} />}
                done={<CheckIcon size={14} />}
              />
              Insert into note
            </Button>
          </Show>
        </HStack>
      </HStack>
      <Show when={open()}>
        <TranscriptSections
          analysis={props.analysis}
          segments={props.segments}
          mode={shown()}
          time={props.time}
          playing={props.playing}
          onSeek={props.onSeek}
        />
      </Show>
    </Stack>
  );
};
