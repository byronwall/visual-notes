import { A } from "@solidjs/router";
import { For, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Box, Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import {
  BUCKET_META,
  RAIL_BUCKETS,
  dotColor,
  type BucketId,
} from "./cleanup-buckets";

const bucketButton = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  w: "full",
  px: "2.5",
  py: "1.5",
  borderRadius: "l2",
  fontSize: "sm",
  color: "fg.default",
  textAlign: "left",
  cursor: "pointer",
  _hover: { bg: "gray.a3" },
  "&[aria-current=true]": { bg: "gray.a3", fontWeight: "medium" },
});

/** Buckets with open counts, then the archive link. */
export const CleanupRail: VoidComponent<{
  counts: Record<string, number>;
  archived: number;
  selected: BucketId;
  onSelect: (bucket: BucketId) => void;
}> = (props) => (
  <Stack gap="0.5" as="nav" aria-label="Cleanup buckets">
    <For each={RAIL_BUCKETS}>
      {(bucket) => (
        <button
          type="button"
          class={bucketButton}
          aria-current={props.selected === bucket}
          onClick={() => props.onSelect(bucket)}
        >
          <Box
            w="2"
            h="2"
            borderRadius="full"
            flexShrink="0"
            style={{ background: dotColor(BUCKET_META[bucket].dot) }}
          />
          <Box flex="1">{BUCKET_META[bucket].label}</Box>
          <Text
            as="span"
            fontSize="xs"
            color="fg.muted"
            fontVariantNumeric="tabular-nums"
          >
            {props.counts[bucket] ?? 0}
          </Text>
        </button>
      )}
    </For>
    <Box borderTopWidth="1px" borderColor="border" my="2" />
    <A href="/docs/archived" class={bucketButton}>
      <Box flex="1" color="fg.muted">
        Archived
      </Box>
      <Text
        as="span"
        fontSize="xs"
        color="fg.muted"
        fontVariantNumeric="tabular-nums"
      >
        {props.archived}
      </Text>
    </A>
    <Text fontSize="xs" color="fg.subtle" px="2.5">
      Deleted 30 days after archiving
    </Text>
  </Stack>
);
