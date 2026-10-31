import { For, Show, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import type { QueueRow } from "~/server/cleanup/queue";

const row = css({
  display: "block",
  w: "full",
  textAlign: "left",
  px: "3",
  py: "2.5",
  borderBottomWidth: "1px",
  borderColor: "border",
  cursor: "pointer",
  _hover: { bg: "gray.a2" },
  "&[aria-selected=true]": { bg: "gray.a3" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "border.focus",
    outlineOffset: "-2px",
  },
});

/** One bucket's notes, highest confidence first. */
export const CleanupQueueList: VoidComponent<{
  items: QueueRow[];
  selectedId: string | null;
  onSelect: (docId: string) => void;
}> = (props) => (
  <Box role="listbox" aria-label="Notes to review" overflowY="auto" minH="0">
    <Show
      when={props.items.length}
      fallback={
        <Text fontSize="sm" color="fg.muted" px="3" py="6">
          Nothing left in this bucket.
        </Text>
      }
    >
      <For each={props.items}>
        {(item) => (
          <button
            type="button"
            role="option"
            id={`cleanup-row-${item.docId}`}
            data-testid="cleanup-row"
            class={row}
            aria-selected={props.selectedId === item.docId}
            onClick={() => props.onSelect(item.docId)}
          >
            <Stack gap="1">
              <Text fontSize="sm" fontWeight="medium" truncate>
                {item.title || "Untitled note"}
              </Text>
              <Text fontSize="xs" color="fg.muted" truncate>
                {item.meta}
              </Text>
              <HStack gap="2">
                <Box
                  flex="1"
                  h="1"
                  bg="gray.a3"
                  borderRadius="full"
                  overflow="hidden"
                >
                  <Box
                    h="full"
                    bg="fg.muted"
                    borderRadius="full"
                    style={{ width: `${Math.round(item.confidence * 100)}%` }}
                  />
                </Box>
                <Text
                  as="span"
                  fontSize="xs"
                  color="fg.muted"
                  fontVariantNumeric="tabular-nums"
                >
                  {item.confidence.toFixed(2)}
                </Text>
              </HStack>
            </Stack>
          </button>
        )}
      </For>
    </Show>
  </Box>
);
