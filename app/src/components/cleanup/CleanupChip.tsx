import { A, useAction } from "@solidjs/router";
import { createKeptAsync } from "~/utils/kept-async";
import { For, Show, createSignal, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { button } from "styled-system/recipes";
import { Button } from "~/components/ui/button";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";
import { snoozeNoteAction } from "~/services/cleanup/cleanup.actions";
import { fetchNoteCleanupHint } from "~/services/cleanup/cleanup.queries";
import {
  BUCKET_META,
  RAIL_BUCKETS,
  dotColor,
  isBucketId,
} from "./cleanup-buckets";

const chip = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  h: "7",
  px: "2",
  borderRadius: "l2",
  fontSize: "xs",
  color: "fg.muted",
  cursor: "pointer",
  whiteSpace: "nowrap",
  _hover: { bg: "gray.a3", color: "fg.default" },
});

/**
 * A quiet "Cleanup: distill" chip in a flagged note's header. The popover
 * gives the reasons, Review (opens the triage page on this note), and Not now
 * (snoozes the suggestion for 30 days).
 */
export const CleanupChip: VoidComponent<{ docId: string }> = (props) => {
  const hint = createKeptAsync(() => fetchNoteCleanupHint(props.docId));
  const snooze = useAction(snoozeNoteAction);
  const [open, setOpen] = createSignal(false);

  return (
    <Show when={hint()}>
      {(h) => {
        // Only buckets the triage page can act on get a chip.
        const meta = () => {
          const bucket = h().bucket;
          return isBucketId(bucket) && RAIL_BUCKETS.includes(bucket)
            ? BUCKET_META[bucket]
            : null;
        };
        return (
          <Show when={meta()}>
            {(m) => (
              <SimplePopover
                open={open()}
                onClose={() => setOpen(false)}
                placement="bottom-end"
                offset={6}
                style={{ width: "min(20rem, 92vw)" }}
                anchor={
                  <button
                    type="button"
                    class={chip}
                    data-testid="cleanup-chip"
                    aria-label={`Cleanup suggestion: ${m().label}`}
                    onClick={() => setOpen((v) => !v)}
                  >
                    <Box
                      w="1.5"
                      h="1.5"
                      borderRadius="full"
                      style={{ background: dotColor(m().dot) }}
                    />
                    Cleanup: {m().label.toLowerCase()}
                  </button>
                }
              >
                <Stack gap="2.5" p="3" data-testid="cleanup-chip-popover">
                  <Text fontSize="sm" color="fg.default">
                    {m().blurb}
                  </Text>
                  <Stack gap="1">
                    <For each={h().signals}>
                      {(signal) => (
                        <Text fontSize="xs" color="fg.muted">
                          {signal.label}
                        </Text>
                      )}
                    </For>
                  </Stack>
                  <HStack gap="2">
                    <A
                      href={`/cleanup?bucket=${h().bucket}&doc=${props.docId}`}
                      class={button({ size: "xs", variant: "solid" })}
                    >
                      Review
                    </A>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setOpen(false);
                        void snooze(props.docId);
                      }}
                    >
                      Not now
                    </Button>
                  </HStack>
                </Stack>
              </SimplePopover>
            )}
          </Show>
        );
      }}
    </Show>
  );
};
