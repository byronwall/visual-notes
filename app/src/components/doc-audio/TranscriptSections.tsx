import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
  onMount,
} from "solid-js";
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

// After the reader scrolls by hand, playback stops pulling the view back.
const FOLLOW_PAUSE_MS = 4000;
const NOW = { _light: "amber.a4", _dark: "amber.a5" };

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
  let manualUntil = 0;
  const [moreBelow, setMoreBelow] = createSignal(false);
  const groups = createMemo(() =>
    segmentsBySection(props.analysis, props.segments),
  );
  const starts = createMemo(() =>
    props.analysis.sections.map((s) => stampSeconds(s.start)),
  );
  // Wide enough for the longest stamp, so titles share one left edge.
  const stampWidth = () =>
    `calc(${formatStamp(starts().at(-1) ?? 0).length}ch + 0.5rem)`;
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

  const measure = () => {
    if (!scroller) return;
    const rest =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    setMoreBelow(rest > 4);
  };
  onMount(measure);
  createEffect(on(() => props.mode, measure, { defer: true }));

  // Follow playback inside the scroller only, never the page.
  createEffect(
    on([activeSegment, activeSection, () => props.mode], () => {
      if (!props.playing || !scroller || Date.now() < manualUntil) return;
      const el = scroller.querySelector<HTMLElement>("[data-active]");
      if (!el) return;
      const top = el.offsetTop;
      const view = scroller.scrollTop;
      if (top < view || top + el.offsetHeight > view + scroller.clientHeight) {
        scroller.scrollTo({ top: top - scroller.clientHeight / 3 });
      }
    }),
  );
  const pauseFollow = () => (manualUntil = Date.now() + FOLLOW_PAUSE_MS);

  return (
    <Box position="relative">
      <Box
        ref={scroller}
        position="relative"
        maxH="min(60vh, 36rem)"
        overflowY="auto"
        // Room for focus rings, given back so text keeps the row's edge.
        px="1"
        mx="-1"
        py="1"
        onScroll={measure}
        onWheel={pauseFollow}
        onTouchMove={pauseFollow}
        data-testid="transcript-sections"
      >
        <Stack gap="4">
          <For each={props.analysis.sections}>
            {(section, i) => {
              const now = () => activeSection() === i();
              return (
                <Stack
                  gap="1"
                  data-active={
                    props.mode === "summary" && now() ? "" : undefined
                  }
                >
                  <HStack gap="2" alignItems="baseline">
                    <Button
                      size="2xs"
                      variant="plain"
                      px="1"
                      ml="-1"
                      justifyContent="flex-start"
                      flexShrink="0"
                      fontVariantNumeric="tabular-nums"
                      fontWeight="normal"
                      color={now() ? "amber.11" : "fg.muted"}
                      style={{ "min-width": stampWidth() }}
                      aria-label={`Play from ${formatStamp(starts()[i()]!)}`}
                      onClick={() => props.onSeek(starts()[i()]!)}
                    >
                      {formatStamp(starts()[i()]!)}
                    </Button>
                    <Text
                      fontSize="sm"
                      fontWeight="medium"
                      lineHeight="1.25rem"
                      color="fg.default"
                    >
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
                              px="0.5"
                              mx="-0.5"
                              // Keep the rounded highlight on every wrapped line.
                              style={{
                                "box-decoration-break": "clone",
                                "-webkit-box-decoration-break": "clone",
                              }}
                              transition="background-color 0.14s"
                              bg={activeSegment() === seg ? NOW : "transparent"}
                              _hover={{
                                bg: activeSegment() === seg ? NOW : "gray.a3",
                              }}
                              data-active={
                                activeSegment() === seg ? "" : undefined
                              }
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
              );
            }}
          </For>
        </Stack>
      </Box>
      {/* Says the transcript continues below the fold. */}
      <Box
        position="absolute"
        insetX="0"
        bottom="0"
        h="8"
        pointerEvents="none"
        bgGradient="to-b"
        gradientFrom="transparent"
        gradientTo="bg.default"
        transition="opacity 0.14s"
        style={{ opacity: moreBelow() ? 1 : 0 }}
      />
    </Box>
  );
};
