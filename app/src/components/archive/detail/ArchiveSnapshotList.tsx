import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { RowList, RowListRow } from "~/components/ui/row-list";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { formatRelativeTime } from "~/features/docs-index/utils/time";
import type { ArchivedPageSnapshotItem } from "~/services/archive/archive.types";

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CAPTURE_MODE_LABEL: Record<
  ArchivedPageSnapshotItem["captureMode"],
  string
> = {
  bulk: "Full page",
  targeted: "Selection",
};

const cols = css({ gridTemplateColumns: "minmax(0, 1fr) max-content" });
const row = css({
  rowGap: "0.5",
  py: "2",
  alignItems: "start",
  transitionProperty: "background-color",
  transitionDuration: "fast",
  _hover: { bg: "gray.a2" },
});

export const ArchiveSnapshotList = (props: {
  snapshots: ArchivedPageSnapshotItem[];
  pageTitle: string;
}) => (
  <RowList class={cols}>
    <For each={props.snapshots}>
      {(snapshot) => (
        <RowListRow class={row}>
          <HStack gap="2" minW="0" fontSize="sm">
            <Text as="span" fontWeight="medium" whiteSpace="nowrap">
              {CAPTURE_MODE_LABEL[snapshot.captureMode]}
            </Text>
            <Text as="span" color="fg.muted" fontSize="xs" whiteSpace="nowrap">
              {formatRelativeTime(snapshot.capturedAt)}
            </Text>
            <Show when={formatBytes(snapshot.htmlSizeBytes)}>
              {(size) => (
                <Text
                  as="span"
                  color="fg.subtle"
                  fontSize="xs"
                  whiteSpace="nowrap"
                >
                  {size()}
                </Text>
              )}
            </Show>
            <Show when={snapshot.title && snapshot.title !== props.pageTitle}>
              <Text as="span" color="fg.muted" fontSize="xs" minW="0" truncate>
                {snapshot.title}
              </Text>
            </Show>
          </HStack>
          <HStack gap="3" fontSize="xs">
            <Link
              href={`/admin/archive/snapshots/${snapshot.id}`}
              fontSize="xs"
            >
              Review
            </Link>
            <Show when={snapshot.htmlPath}>
              <Link
                href={`/api/archive/snapshots/${snapshot.id}/html?download=1`}
                fontSize="xs"
              >
                HTML
              </Link>
            </Show>
          </HStack>
          <Show when={snapshot.textSnippet}>
            {(snippet) => (
              <Text
                gridColumn="1 / -1"
                fontSize="xs"
                color="fg.muted"
                lineClamp="2"
              >
                {snippet()}
              </Text>
            )}
          </Show>
        </RowListRow>
      )}
    </For>
  </RowList>
);
