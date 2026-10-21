import { A, useAction } from "@solidjs/router";
import { XIcon } from "lucide-solid";
import { For, Show, createResource } from "solid-js";
import { css } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { Badge } from "~/components/ui/badge";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import type { CalendarFeed, FeedEntryMode } from "~/lib/events/types";
import { setCalendarFeedEntry } from "~/services/events/feeds.actions";
import { fetchFeedEntries } from "~/services/events/feeds.queries";
import { FeedEventPicker } from "./FeedEventPicker";
import { FeedSection } from "./FeedSection";
import { useFeedsRefresh } from "./feedsRefresh";

const titleLink = css({
  fontSize: "sm",
  color: "fg.default",
  textDecoration: "none",
  truncate: true,
  flex: "1",
  minW: "0",
  _hover: { textDecoration: "underline" },
});

/** Events added to or hidden from this feed by hand, on top of the rule. */
export function FeedManualEntries(props: { feed: CalendarFeed }) {
  const refresh = useFeedsRefresh();
  const runSetEntry = useAction(setCalendarFeedEntry);
  const [entries] = createResource(
    () => ({ feedId: props.feed.id, v: refresh.version() }),
    ({ feedId, v }) => fetchFeedEntries(feedId, v),
  );

  const setEntry = async (eventId: string, mode: FeedEntryMode | null) => {
    await runSetEntry({ feedId: props.feed.id, eventId, mode });
    refresh.bump();
  };

  return (
    <FeedSection
      title="Manual entries"
      hint="Included events publish every show regardless of the rule. Excluded events never publish."
    >
      <Show when={(entries.latest ?? []).length > 0}>
        <Stack as="ul" gap="0" listStyle="none" m="0" p="0">
          <For each={entries.latest}>
            {(entry) => (
              <HStack
                as="li"
                gap="2"
                py="1"
                borderBottomWidth="1px"
                borderColor="border.subtle"
              >
                <Badge
                  size="sm"
                  variant="subtle"
                  colorPalette={entry.mode === "include" ? "green" : "red"}
                  w="16"
                  justifyContent="center"
                  flexShrink="0"
                >
                  {entry.mode === "include" ? "Included" : "Excluded"}
                </Badge>
                <A href={`/docs/${entry.docId}`} class={titleLink}>
                  {entry.title}
                </A>
                <IconButton
                  size="xs"
                  variant="plain"
                  aria-label={`Remove ${entry.title} from manual entries`}
                  title="Remove manual entry"
                  onClick={() => void setEntry(entry.eventId, null)}
                >
                  <XIcon />
                </IconButton>
              </HStack>
            )}
          </For>
        </Stack>
      </Show>
      <Show when={entries.latest && entries.latest.length === 0}>
        <Text fontSize="sm" color="fg.subtle">
          None yet.
        </Text>
      </Show>
      <FeedEventPicker
        existing={new Set((entries.latest ?? []).map((e) => e.eventId))}
        onPick={(eventId, mode) => void setEntry(eventId, mode)}
      />
    </FeedSection>
  );
}
