import { createAsync, useAction } from "@solidjs/router";
import {
  For,
  Show,
  Suspense,
  createMemo,
  createSignal,
  type VoidComponent,
} from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Skeleton } from "~/components/ui/skeleton";
import { Text } from "~/components/ui/text";
import type { QueueRow } from "~/server/cleanup/queue";
import {
  keepNoteAction,
  snoozeNoteAction,
} from "~/services/cleanup/cleanup.actions";
import {
  fetchCleanupDaily,
  fetchCleanupItem,
} from "~/services/cleanup/cleanup.queries";
import { CleanupSnoozeContext } from "./CleanupActionBar";
import { CleanupDetail } from "./CleanupDetail";
import { CleanupModeToggle } from "./CleanupModeToggle";
import { CleanupRunStatus } from "./CleanupRunStatus";
import { DetailSkeleton } from "./CleanupSkeletons";
import { BUCKET_META, dotColor, isBucketId } from "./cleanup-buckets";
import { useCleanupKeys } from "./useCleanupKeys";

const minutesLeft = (cards: number) => Math.max(1, Math.round(cards * 0.4));

/**
 * Daily maintenance: one card at a time from a small quota across every
 * bucket, with Snooze. Skipped cards drop to the back for this visit.
 */
export const DailyStack: VoidComponent = () => (
  <Stack
    gap="5"
    maxW="3xl"
    mx="auto"
    px={{ base: "4", md: "6" }}
    py="6"
    w="full"
  >
    <Stack gap="2" alignItems="center">
      <CleanupModeToggle mode="daily" />
      <CleanupRunStatus inline />
    </Stack>
    <Suspense fallback={<DetailSkeleton />}>
      <DailyCards />
    </Suspense>
  </Stack>
);

const DailyCards: VoidComponent = () => {
  const daily = createAsync(() => fetchCleanupDaily());
  const keep = useAction(keepNoteAction);
  const snooze = useAction(snoozeNoteAction);
  const [skipped, setSkipped] = createSignal<string[]>([]);

  const today = createMemo(() => {
    const d = daily.latest;
    if (!d) return [];
    const cards = d.items.slice(0, d.remaining);
    const later = new Set(skipped());
    return [
      ...cards.filter((c) => !later.has(c.docId)),
      ...cards.filter((c) => later.has(c.docId)),
    ];
  });
  const upcoming = () => {
    const d = daily.latest;
    return d ? d.items.slice(d.remaining) : [];
  };
  const current = () => today()[0] ?? null;
  const progress = () => {
    const d = daily.latest;
    if (!d) return { done: 0, total: 0 };
    return { done: d.doneToday, total: d.doneToday + d.remaining };
  };

  const skip = () => {
    const c = current();
    if (c) setSkipped([...skipped().filter((id) => id !== c.docId), c.docId]);
  };
  useCleanupKeys(() => {});

  return (
    <>
      <Stack gap="3" alignItems="center">
        <Text fontSize="sm" color="fg.muted" data-testid="daily-progress">
          <Text as="span" color="fg.default" fontWeight="medium">
            Today: {progress().done} of {progress().total}
          </Text>
          <Show when={today().length}>
            {" "}
            · about {minutesLeft(today().length)} min left
          </Show>
        </Text>
        <Box
          w="full"
          maxW="sm"
          h="1.5"
          bg="gray.a3"
          borderRadius="full"
          overflow="hidden"
        >
          <Box
            h="full"
            bg="fg.default"
            style={{
              width: `${progress().total ? Math.round((progress().done / progress().total) * 100) : 0}%`,
            }}
          />
        </Box>
      </Stack>
      <Show
        when={current()}
        keyed
        fallback={
          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="l3"
            px="6"
            py="10"
            textAlign="center"
            bg="bg.default"
          >
            <Text fontSize="md" fontWeight="medium">
              <Show
                when={daily.latest?.openTotal}
                fallback="Nothing to clean up."
              >
                Done for today.
              </Show>
            </Text>
            <Text fontSize="sm" color="fg.muted" mt="1">
              <Show
                when={daily.latest?.openTotal}
                fallback="New suggestions show up here as notes change."
              >
                {daily.latest?.openTotal} more suggestions wait in the deep pass.
              </Show>
            </Text>
          </Box>
        }
      >
        {(card) => (
          <DailyCard
            card={card}
            stacked={today().length > 1}
            onSkip={skip}
            onKeep={() => void keep(card.docId)}
            onSnooze={() => void snooze(card.docId)}
          />
        )}
      </Show>
      <Show when={upcoming().length}>
        <HStack
          gap="2"
          flexWrap="wrap"
          justify="center"
          data-testid="daily-upcoming"
        >
          <For each={upcoming()}>
            {(next) => {
              const meta = isBucketId(next.bucket)
                ? BUCKET_META[next.bucket]
                : null;
              return (
                <HStack
                  gap="2"
                  px="3"
                  py="1.5"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="full"
                  fontSize="xs"
                  color="fg.muted"
                  maxW="20rem"
                >
                  <Box
                    w="1.5"
                    h="1.5"
                    borderRadius="full"
                    flexShrink="0"
                    style={{
                      background: meta ? dotColor(meta.dot) : undefined,
                    }}
                  />
                  <Text as="span" truncate>
                    <Text as="span" color="fg.default" fontWeight="medium">
                      {meta?.label}:
                    </Text>{" "}
                    {next.title}
                  </Text>
                </HStack>
              );
            }}
          </For>
        </HStack>
      </Show>
    </>
  );
};

/** One card: fetches its note's detail and shows the bucket's panel. */
const DailyCard: VoidComponent<{
  card: QueueRow;
  stacked: boolean;
  onSkip: () => void;
  onKeep: () => void;
  onSnooze: () => void;
}> = (props) => {
  const item = createAsync(() =>
    fetchCleanupItem(props.card.docId, props.card.bucket),
  );
  return (
    <Box position="relative" data-testid="daily-card">
      <Box
        position="absolute"
        inset="0"
        transform="translateY(10px) scale(0.97)"
        borderWidth="1px"
        borderColor="border"
        borderRadius="l3"
        bg="bg.default"
        opacity={props.stacked ? 1 : 0}
      />
      <Box
        position="relative"
        borderWidth="1px"
        borderColor="border"
        borderRadius="l3"
        bg="bg.default"
        px={{ base: "4", md: "6" }}
        py="5"
        boxShadow="sm"
        minH="24rem"
        display="flex"
        flexDirection="column"
      >
        <Suspense
          fallback={
            <Stack gap="3" aria-busy="true" aria-label="Loading card">
              <Skeleton h="6" w="60%" />
              <Skeleton h="16" w="full" />
            </Stack>
          }
        >
          <Show when={item.latest}>
            {(detail) => (
              <CleanupSnoozeContext.Provider value={props.onSnooze}>
                <BucketPill bucket={props.card.bucket} />
                <CleanupDetail
                  item={detail()}
                  onDone={() => {}}
                  onSkip={props.onSkip}
                  onKeep={props.onKeep}
                />
              </CleanupSnoozeContext.Provider>
            )}
          </Show>
        </Suspense>
      </Box>
    </Box>
  );
};

const BucketPill: VoidComponent<{ bucket: string }> = (props) => {
  const meta = () =>
    isBucketId(props.bucket) ? BUCKET_META[props.bucket] : null;
  return (
    <Show when={meta()}>
      {(m) => (
        <HStack
          gap="1.5"
          px="2"
          py="0.5"
          mb="3"
          w="fit-content"
          borderRadius="l2"
          bg="gray.a3"
          fontSize="xs"
          fontWeight="medium"
          data-testid="daily-bucket"
        >
          <Box
            w="1.5"
            h="1.5"
            borderRadius="full"
            style={{ background: dotColor(m().dot) }}
          />
          {m().label}
        </HStack>
      )}
    </Show>
  );
};
