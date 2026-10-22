import {
  ErrorBoundary,
  For,
  Show,
  Suspense,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { createAsync, revalidate, useLocation } from "@solidjs/router";
import { Box, Stack } from "styled-system/jsx";
import { css } from "styled-system/css";
import { fetchRecentItems } from "~/services/recents/recents.queries";
import type { RecentItem } from "~/services/recents/recents.types";
import { RecentRow } from "./RecentRow";

/** A malformed escape in the URL must not take down the sidebar. */
const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const PLACEHOLDER_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];
const CLOCK_TICK_MS = 30_000;

const sectionLabelClass = css({
  px: "2",
  pt: "1",
  pb: "1",
  fontSize: "xs",
  fontWeight: "medium",
  color: "fg.subtle",
});

const messageClass = css({
  px: "2",
  py: "1.5",
  fontSize: "sm",
  color: "fg.subtle",
  lineHeight: "snug",
});

const retryClass = css({
  color: "fg.muted",
  textDecorationLine: "underline",
  cursor: "pointer",
  _hover: { color: "fg.default" },
});

// Fades the last row into the footer so a clipped row reads as "scroll for
// more" rather than a layout bug.
const listClass = css({
  flex: "1",
  minH: "0",
  overflowY: "auto",
  scrollbarWidth: "thin",
  pb: "4",
  maskImage: "linear-gradient(to bottom, black calc(100% - 24px), transparent)",
});

/** Re-renders relative times every 30s; the sidebar outlives navigation. */
const createClock = () => {
  const [now, setNow] = createSignal(Date.now());
  onMount(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    onCleanup(() => window.clearInterval(timer));
  });
  return now;
};

const RecentList = () => {
  const location = useLocation();
  const now = createClock();
  const items = createAsync(() => fetchRecentItems(30));
  const isCurrent = (item: RecentItem) =>
    safeDecode(location.pathname) === safeDecode(item.href);

  return (
    <Suspense
      fallback={
        <Stack gap="0.5" aria-hidden="true">
          <For each={PLACEHOLDER_ROWS}>
            {() => (
              <Box h="7" px="2" display="flex" alignItems="center" gap="2">
                <Box boxSize="3.5" borderRadius="l1" bg="gray.a3" />
                <Box h="2.5" w="65%" borderRadius="l1" bg="gray.a3" />
              </Box>
            )}
          </For>
        </Stack>
      }
    >
      <Show
        when={(items()?.length ?? 0) > 0}
        fallback={
          <Box class={messageClass}>
            Notes, collections, and topics you create or edit show up here.
          </Box>
        }
      >
        <Stack as="ul" gap="0.5" m="0" p="0" listStyle="none" class={listClass}>
          <For each={items()}>
            {(item) => (
              <li>
                <RecentRow
                  item={item}
                  now={now()}
                  current={isCurrent(item)}
                />
              </li>
            )}
          </For>
        </Stack>
      </Show>
    </Suspense>
  );
};

/**
 * Recently created or edited notes, collections, and research topics, newest
 * first. Opening something does not move it. Fills the rest of the sidebar.
 */
export const AppSidebarRecent = (props: { expanded: boolean }) => (
  <Show when={props.expanded}>
    <Box
      as="section"
      aria-label="Recent"
      display="flex"
      flexDirection="column"
      minH="0"
      h="100%"
    >
      <Box class={sectionLabelClass}>Recent</Box>
      <ErrorBoundary
        fallback={(error, reset) => {
          console.warn("[recents] sidebar list failed", error);
          return (
            <Box class={messageClass}>
              Couldn't load recent items.{" "}
              <button
                type="button"
                class={retryClass}
                onClick={() => {
                  void revalidate(fetchRecentItems.key);
                  reset();
                }}
              >
                Retry
              </button>
            </Box>
          );
        }}
      >
        <RecentList />
      </ErrorBoundary>
    </Box>
  </Show>
);
