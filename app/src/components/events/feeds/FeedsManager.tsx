import { For, Show, Suspense, createResource } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Heading } from "~/components/ui/heading";
import { Skeleton } from "~/components/ui/skeleton";
import { Text } from "~/components/ui/text";
import {
  fetchFeedOrigin,
  fetchFeedRuleOptions,
  fetchFeeds,
} from "~/services/events/feeds.queries";
import { FeedCard } from "./FeedCard";
import { NewFeedForm } from "./NewFeedForm";
import { useFeedsRefresh } from "./feedsRefresh";

/** The /events/feeds page body: every feed with its rule and subscribe URL. */
export function FeedsManager() {
  const refresh = useFeedsRefresh();
  const [feeds] = createResource(refresh.version, (v) => fetchFeeds(v));
  const [ruleOptions] = createResource(() => fetchFeedRuleOptions());
  const [origin] = createResource(() => fetchFeedOrigin());

  return (
    <Stack gap="5">
      <HStack
        justify="space-between"
        alignItems="flex-end"
        gap="4"
        flexWrap="wrap"
      >
        <Stack gap="1" minW="0" flex="1 1 20rem">
          <Heading as="h1" fontSize="xl">
            Calendar feeds
          </Heading>
          <Text color="fg.muted" fontSize="sm" maxW="40rem">
            Each feed is its own subscribable calendar. A rule picks events from
            a collection; manual entries add or hide single events on top.
          </Text>
        </Stack>
        <NewFeedForm />
      </HStack>

      <Suspense
        fallback={
          <Stack gap="4">
            <Skeleton h="64" borderRadius="l3" />
          </Stack>
        }
      >
        <Show
          when={(feeds.latest ?? []).length > 0}
          fallback={
            <Show when={feeds.latest}>
              <Box
                borderWidth="1px"
                borderStyle="dashed"
                borderColor="border"
                borderRadius="l3"
                p="8"
                textAlign="center"
              >
                <Text fontWeight="medium">No feeds yet</Text>
                <Text color="fg.muted" fontSize="sm" mt="1">
                  Name a feed above, such as “Date Nights”, then pick which
                  events it publishes.
                </Text>
              </Box>
            </Show>
          }
        >
          <Stack gap="4">
            <For each={feeds.latest}>
              {(feed) => (
                <FeedCard
                  feed={feed}
                  ruleOptions={ruleOptions.latest ?? []}
                  origin={origin.latest ?? ""}
                />
              )}
            </For>
          </Stack>
        </Show>
      </Suspense>
    </Stack>
  );
}
