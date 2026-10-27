import { For, Show, createEffect, createMemo, on } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import {
  type TranscriptAnalysis,
  type TranscriptSegment,
  formatStamp,
  segmentsBySection,
  stampSeconds,
} from "~/services/doc-audio/doc-audio.shared";

export type TranscriptMode = "summary" | "raw";

/**
 * The transcript by section. Summary mode shows each section's edited text;
 * raw mode shows the speech-to-text words under the same headings, and any
 * phrase seeks the player. The spoken part is highlighted and kept in view.
 */
export const TranscriptSections = (props: {
  analysis: TranscriptAnalysis;
  segments: TranscriptSegment[];
  mode: TranscriptMode;
  /** Player position in seconds; null before the first play. */
  time: number | null;
  playing: boolean;
  onSeek: (seconds: number) => void;
}) => {
  let scroller: HTMLDivElement | undefined;
  const groups = createMemo(() =>
    segmentsBySection(props.analysis, props.segments),
  );
  const starts = createMemo(() =>
    props.analysis.sections.map((s) => stampSeconds(s.start)),
  );
  const activeSection = () => {
    const t = props.time;
    if (t === null) return -1;
    return Math.max(0, starts().findLastIndex((start) => start <= t + 0.5));
  };
  const activeSegment = createMemo(() => {
    const t = props.time;
    if (t === null || props.mode !== "raw") return undefined;
    return props.segments.findLast((seg) => seg.start <= t + 0.1);
  });

  // Follow playback inside the scroller only, never the page.
  createEffect(
    on([activeSegment, activeSection, () => props.mode], () => {
      if (!props.playing || !scroller) return;
      const el = scroller.querySelector<HTMLElement>("[data-active]");
      if (!el) return;
      const top = el.offsetTop;
      const view = scroller.scrollTop;
      if (top < view || top + el.offsetHeight > view + scroller.clientHeight) {
        scroller.scrollTo({ top: top - scroller.clientHeight / 3 });
      }
    }),
  );

  return (
    <Box
      ref={scroller}
      position="relative"
      maxH="min(60vh, 36rem)"
      overflowY="auto"
      pr="2"
      data-testid="transcript-sections"
    >
      <Stack gap="3">
        <For each={props.analysis.sections}>
          {(section, i) => (
            <Stack
              gap="0.5"
              data-active={
                props.mode === "summary" && activeSection() === i()
                  ? ""
                  : undefined
              }
            >
              <HStack gap="2" alignItems="baseline">
                <Button
                  size="xs"
                  variant="plain"
                  px="0"
                  h="auto"
                  flexShrink="0"
                  fontVariantNumeric="tabular-nums"
                  color={activeSection() === i() ? "fg.default" : "fg.muted"}
                  aria-label={`Play from ${formatStamp(starts()[i()]!)}`}
                  onClick={() => props.onSeek(starts()[i()]!)}
                >
                  {formatStamp(starts()[i()]!)}
                </Button>
                <Text fontSize="sm" fontWeight="medium">
                  {section.title}
                </Text>
              </HStack>
              <Show
                when={props.mode === "raw"}
                fallback={
                  <Text fontSize="sm" color="fg.muted" lineHeight="relaxed">
                    {section.cleanedText}
                  </Text>
                }
              >
                <Text fontSize="sm" lineHeight="relaxed">
                  <For each={groups()[i()]}>
                    {(seg) => (
                      <>
                        <Box
                          as="span"
                          cursor="pointer"
                          borderRadius="l1"
                          transition="background-color 0.14s"
                          bg={
                            activeSegment() === seg ? "amber.a4" : "transparent"
                          }
                          _hover={{
                            bg: activeSegment() === seg ? "amber.a5" : "gray.a3",
                          }}
                          data-active={activeSegment() === seg ? "" : undefined}
                          title={formatStamp(seg.start)}
                          onClick={() => props.onSeek(seg.start)}
                        >
                          {seg.text}
                        </Box>{" "}
                      </>
                    )}
                  </For>
                </Text>
              </Show>
            </Stack>
          )}
        </For>
      </Stack>
    </Box>
  );
};
