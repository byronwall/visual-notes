import { createAsync } from "@solidjs/router";
import {
  ErrorBoundary,
  Show,
  Suspense,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { ActivityTimeline } from "~/components/activity/ActivityTimeline";
import { ActivityToolbar } from "~/components/activity/ActivityToolbar";
import { useActivityFilters } from "~/components/activity/useActivityFilters";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import { fetchTimelineEvents } from "~/services/activity/activity.queries";
import type { ActionEventItem } from "~/services/activity/activity.types";

const PAGE_SIZE = 100;

const ActivityRoute = () => {
  const filters = useActivityFilters();
  const firstPage = createAsync(() =>
    fetchTimelineEvents({ ...filters.filter(), take: PAGE_SIZE }),
  );
  const [olderPages, setOlderPages] = createSignal<ActionEventItem[]>([]);
  const [loadingOlder, setLoadingOlder] = createSignal(false);
  const [reachedEnd, setReachedEnd] = createSignal(false);

  // Day boundaries start in UTC so SSR and hydration agree, then switch to the
  // viewer zone; relative times tick once a minute.
  const [timeZone, setTimeZone] = createSignal("UTC");
  const [nowMs, setNowMs] = createSignal(Date.now());
  onMount(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    onCleanup(() => clearInterval(timer));
  });

  createEffect(
    on(filters.filter, () => {
      setOlderPages([]);
      setReachedEnd(false);
    }, { defer: true }),
  );

  // Keep showing the previous list while a filter change refetches.
  const page = () => firstPage.latest ?? firstPage();
  const events = createMemo(() => [...(page() ?? []), ...olderPages()]);
  const canLoadOlder = () =>
    !reachedEnd() && (page()?.length ?? 0) >= PAGE_SIZE;

  const handleLoadOlder = async () => {
    const last = events()[events().length - 1];
    if (!last || loadingOlder()) return;
    setLoadingOlder(true);
    try {
      const next = await fetchTimelineEvents({
        ...filters.filter(),
        take: PAGE_SIZE,
        cursor: last.id,
      });
      setOlderPages((pages) => [...pages, ...next]);
      if (next.length < PAGE_SIZE) setReachedEnd(true);
    } catch (error) {
      console.error("[activity] failed to load older events", error);
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Stack gap="4" maxW="960px" mx="auto" px={{ base: "3", md: "6" }} pt="5" pb="24">
        <HStack gap="3" alignItems="baseline" flexWrap="wrap" px="3">
          <Heading as="h1" fontSize="2xl">
            Activity
          </Heading>
          <Show when={page()}>
            <Text fontSize="sm" color="fg.subtle">
              {events().length}
              {canLoadOlder() ? "+" : ""} events
            </Text>
          </Show>
        </HStack>

        <Box px="3">
          <ActivityToolbar filters={filters} />
        </Box>

        <ErrorBoundary
          fallback={(error, reset) => (
            <Stack gap="2" px="3" py="6" alignItems="flex-start">
              <Text color="red.11" fontSize="sm">
                Couldn’t load activity.
              </Text>
              <Text color="fg.muted" fontSize="xs" fontFamily="mono">
                {String(error?.message ?? error)}
              </Text>
              <Button size="xs" variant="outline" onClick={reset}>
                Try again
              </Button>
            </Stack>
          )}
        >
          <Suspense
            fallback={
              <Text px="3" py="6" fontSize="sm" color="fg.muted">
                Loading activity…
              </Text>
            }
          >
            <Show
              when={events().length > 0}
              fallback={
                <Stack gap="2" px="3" py="10" alignItems="flex-start">
                  <Text fontWeight="medium">
                    {filters.hasAnyFilter() ? "No events match these filters" : "No activity yet"}
                  </Text>
                  <Text fontSize="sm" color="fg.muted" maxW="52ch">
                    {filters.hasAnyFilter()
                      ? "Try a different event family or a shorter path prefix."
                      : "Views, edits, searches, and AI runs show up here as you use Visual Notes."}
                  </Text>
                  <Show when={filters.hasAnyFilter()}>
                    <Button size="xs" variant="outline" onClick={() => filters.clearAll()}>
                      Clear filters
                    </Button>
                  </Show>
                </Stack>
              }
            >
              <ActivityTimeline events={events()} timeZone={timeZone()} nowMs={nowMs()} />
              <Show when={canLoadOlder()}>
                <Box px="3" pt="4">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={loadingOlder()}
                    onClick={() => void handleLoadOlder()}
                  >
                    Load older
                  </Button>
                </Box>
              </Show>
            </Show>
          </Suspense>
        </ErrorBoundary>
      </Stack>
    </Box>
  );
};

export default ActivityRoute;
