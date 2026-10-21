import { A } from "@solidjs/router";
import { For, Show, createResource } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Badge } from "~/components/ui/badge";
import { Text } from "~/components/ui/text";
import { formatShowWhen } from "~/lib/events/format";
import {
  DECISION_LABELS,
  STATUS_LABELS,
  type CalendarFeed,
  type OccurrenceListItem,
} from "~/lib/events/types";
import { fetchFeedPreview } from "~/services/events/feeds.queries";
import { FeedSection } from "./FeedSection";
import { useFeedsRefresh } from "./feedsRefresh";

const titleLink = css({
  fontSize: "sm",
  fontWeight: "medium",
  color: "fg.default",
  textDecoration: "none",
  truncate: true,
  _hover: { textDecoration: "underline" },
});

function PreviewRow(props: { show: OccurrenceListItem; year: number }) {
  const cancelled = () => props.show.status === "cancelled";
  return (
    <HStack
      as="li"
      gap="3"
      py="2"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      _last={{ borderBottomWidth: "0" }}
      alignItems="flex-start"
    >
      <Stack gap="0" flex="1" minW="0">
        <A
          href={`/docs/${props.show.docId}`}
          class={titleLink}
          style={
            cancelled() ? { "text-decoration": "line-through" } : undefined
          }
        >
          {props.show.title}
          {props.show.label ? ` — ${props.show.label}` : ""}
        </A>
        <Text fontSize="xs" color="fg.muted" truncate>
          {formatShowWhen(props.show, props.year)}
          {props.show.effectivePlace
            ? ` · ${props.show.effectivePlace.name}`
            : ""}
        </Text>
      </Stack>
      <Badge
        size="sm"
        variant="outline"
        colorPalette={cancelled() ? "red" : "gray"}
        flexShrink="0"
      >
        {cancelled()
          ? STATUS_LABELS.cancelled
          : DECISION_LABELS[props.show.effectiveDecision]}
      </Badge>
    </HStack>
  );
}

/** The next shows this feed publishes, exactly as the iCal route resolves them. */
export function FeedPreviewList(props: { feed: CalendarFeed }) {
  const refresh = useFeedsRefresh();
  const [preview] = createResource(
    () => ({ feedId: props.feed.id, v: refresh.version() }),
    ({ feedId }) => fetchFeedPreview({ feedId, limit: 10 }),
  );
  const year = new Date().getFullYear();
  const summary = () => {
    const p = preview.latest;
    if (!p) return "";
    const more = p.upcomingCount > p.upcoming.length;
    return `${p.upcomingCount} upcoming${more ? `, showing ${p.upcoming.length}` : ""} · ${p.pastCount} past`;
  };

  return (
    <FeedSection
      title="Next in this feed"
      aside={
        <Text fontSize="xs" color="fg.subtle">
          {summary()}
        </Text>
      }
    >
      <Show
        when={(preview.latest?.upcoming.length ?? 0) > 0}
        fallback={
          <Box
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="border"
            borderRadius="l2"
            p="4"
          >
            <Text fontSize="sm" color="fg.muted">
              {preview.latest
                ? "No upcoming shows match yet."
                : "Loading shows…"}
            </Text>
          </Box>
        }
      >
        <Stack as="ul" gap="0" listStyle="none" m="0" p="0">
          <For each={preview.latest?.upcoming}>
            {(show) => <PreviewRow show={show} year={year} />}
          </For>
        </Stack>
      </Show>
    </FeedSection>
  );
}
