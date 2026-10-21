import { useAction } from "@solidjs/router";
import { For, Show, createResource, createSignal } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Checkbox from "~/components/ui/checkbox";
import { Text } from "~/components/ui/text";
import type { FeedMembership } from "~/server/calendar/feed-store";
import { setCalendarFeedEntry } from "~/services/events/feeds.actions";
import { fetchEventFeeds } from "~/services/events/feeds.queries";
import { useFeedsRefresh } from "./feedsRefresh";

export type EventFeedTogglesProps = { eventId: string };

const stateLabel = (m: FeedMembership) => {
  if (m.mode === "include")
    return m.byRule ? "Added manually (rule also matches)" : "Added manually";
  if (m.mode === "exclude")
    return m.byRule ? "Excluded (rule matches)" : "Excluded";
  return m.byRule ? "In feed by rule" : "Not in feed";
};

/** The override that flips membership with the fewest manual entries. */
const nextMode = (m: FeedMembership) => {
  if (m.inFeed) return m.byRule ? "exclude" : null;
  return m.byRule ? null : "include";
};

/**
 * Every feed with a checkbox for whether this event publishes there.
 * Checking adds a manual include (or clears an exclude); unchecking adds an
 * exclude (or clears an include). "Reset" returns the feed to its rule.
 */
export function EventFeedToggles(props: EventFeedTogglesProps) {
  const refresh = useFeedsRefresh();
  const runSetEntry = useAction(setCalendarFeedEntry);
  const [busyFeed, setBusyFeed] = createSignal<string | null>(null);
  const [feeds] = createResource(
    () => ({ eventId: props.eventId, v: refresh.version() }),
    ({ eventId }) => fetchEventFeeds(eventId),
  );

  const apply = async (
    m: FeedMembership,
    mode: "include" | "exclude" | null,
  ) => {
    setBusyFeed(m.feed.id);
    try {
      await runSetEntry({ feedId: m.feed.id, eventId: props.eventId, mode });
      refresh.bump();
    } finally {
      setBusyFeed(null);
    }
  };

  return (
    <Stack gap="1">
      <Show when={feeds.latest && feeds.latest.length === 0}>
        <Text fontSize="sm" color="fg.muted">
          No feeds yet. Create one under Events → Feeds.
        </Text>
      </Show>
      <For each={feeds.latest}>
        {(m) => (
          <HStack gap="2" py="1" minW="0">
            <Checkbox.Root
              size="sm"
              checked={m.inFeed}
              disabled={busyFeed() === m.feed.id}
              onCheckedChange={() => void apply(m, nextMode(m))}
              flex="1"
              minW="0"
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Stack gap="0" minW="0">
                <Checkbox.Label fontSize="sm" truncate>
                  {m.feed.name}
                </Checkbox.Label>
                <Text
                  fontSize="xs"
                  color={m.mode === "exclude" ? "fg.error" : "fg.muted"}
                >
                  {stateLabel(m)}
                </Text>
              </Stack>
            </Checkbox.Root>
            <Show when={m.mode}>
              <Button
                size="xs"
                variant="plain"
                disabled={busyFeed() === m.feed.id}
                onClick={() => void apply(m, null)}
                title="Remove the manual entry and follow the feed's rule"
              >
                Reset
              </Button>
            </Show>
          </HStack>
        )}
      </For>
    </Stack>
  );
}
