import { createAsync, useAction, useSearchParams } from "@solidjs/router";
import { Show, Suspense, type VoidComponent } from "solid-js";
import { Box, Grid, Stack } from "styled-system/jsx";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import { keepNoteAction } from "~/services/cleanup/cleanup.actions";
import {
  fetchCleanupItem,
  fetchCleanupOverview,
  fetchCleanupQueue,
} from "~/services/cleanup/cleanup.queries";
import { CleanupDetail } from "./CleanupDetail";
import { CleanupModeToggle } from "./CleanupModeToggle";
import { DailyStack } from "./DailyStack";
import { CleanupQueueList } from "./CleanupQueueList";
import { CleanupRail } from "./CleanupRail";
import { CleanupRunStatus } from "./CleanupRunStatus";
import { DetailSkeleton, QueueSkeleton } from "./CleanupSkeletons";
import { BUCKET_META, RAIL_BUCKETS, type BucketId } from "./cleanup-buckets";
import { useCleanupKeys } from "./useCleanupKeys";

const pane = { minH: "0", overflowY: "auto" } as const;

/** Daily stack or deep-pass triage, by `?mode=`. */
export const CleanupWorkspace: VoidComponent = () => {
  const [params] = useSearchParams();
  return (
    <Show when={params.mode === "daily"} fallback={<DeepPass />}>
      <DailyStack />
    </Show>
  );
};

const QueueHeader: VoidComponent<{ bucket: BucketId | ""; total?: number }> = (
  props,
) => (
  <Stack gap="1" px="3" py="4" borderBottomWidth="1px" borderColor="border">
    <Text fontSize="md" fontWeight="semibold">
      <Show when={props.bucket} fallback={" "}>
        {BUCKET_META[props.bucket as BucketId].label} · {props.total ?? "–"}{" "}
        notes
      </Show>
    </Text>
    <Text fontSize="xs" color="fg.muted" minH="2lh">
      {props.bucket ? BUCKET_META[props.bucket].blurb : ""}
    </Text>
  </Stack>
);

/**
 * Deep-pass triage: buckets, the selected bucket's queue, and one note. The
 * page paints at once, and each column fills in behind its own boundary.
 */
const DeepPass: VoidComponent = () => {
  const [params, setParams] = useSearchParams();
  const overview = createAsync(() => fetchCleanupOverview());
  const requested = (): BucketId | "" => {
    const bucket = params.bucket as BucketId;
    return RAIL_BUCKETS.includes(bucket) ? bucket : "";
  };
  const queue = createAsync(() => fetchCleanupQueue(requested()));
  const bucket = () =>
    requested() || ((queue.latest?.bucket ?? RAIL_BUCKETS[0]) as BucketId);
  const ids = () => (queue.latest?.rows ?? []).map((row) => row.docId);
  const selectedId = () => {
    const doc = params.doc as string | undefined;
    return doc && ids().includes(doc) ? doc : ids()[0] ?? null;
  };
  const keep = useAction(keepNoteAction);

  const select = (docId: string | null) => {
    setParams({ doc: docId ?? undefined }, { replace: true });
    if (docId) {
      document
        .getElementById(`cleanup-row-${docId}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  };
  const move = (delta: number) => {
    const list = ids();
    if (!list.length) return;
    const index = Math.max(0, list.indexOf(selectedId() ?? ""));
    select(list[Math.min(list.length - 1, Math.max(0, index + delta))]);
  };
  /** After an item leaves the queue, select its neighbor. */
  const advance = () => {
    const list = ids();
    const index = list.indexOf(selectedId() ?? "");
    select(list[index + 1] ?? list[index - 1] ?? null);
  };
  useCleanupKeys(move);
  const onBucket = (next: BucketId) =>
    setParams({ bucket: next, doc: undefined });

  return (
    <Grid
      h={{ base: "auto", md: "100dvh" }}
      gridTemplateColumns={{ base: "1fr", md: "190px 320px 1fr" }}
      gap="0"
      bg="bg.default"
    >
      <Stack
        gap="4"
        px="4"
        py="5"
        borderRightWidth={{ md: "1px" }}
        borderColor="border"
        {...pane}
      >
        <Heading as="h1" fontSize="lg">
          Cleanup
        </Heading>
        <CleanupModeToggle mode="deep" />
        <Suspense
          fallback={<CleanupRail selected={requested()} onSelect={onBucket} />}
        >
          <CleanupRail
            counts={overview.latest?.counts}
            archived={overview.latest?.archived}
            selected={bucket()}
            onSelect={onBucket}
          />
        </Suspense>
        <CleanupRunStatus />
      </Stack>
      <Stack
        gap="0"
        borderRightWidth={{ md: "1px" }}
        borderColor="border"
        {...pane}
      >
        <Suspense
          fallback={
            <>
              <QueueHeader bucket={requested()} />
              <QueueSkeleton />
            </>
          }
        >
          <QueueHeader bucket={bucket()} total={queue.latest?.total} />
          <CleanupQueueList
            items={queue.latest?.rows ?? []}
            selectedId={selectedId()}
            onSelect={select}
          />
        </Suspense>
      </Stack>
      <Box
        px={{ base: "4", md: "6" }}
        py="5"
        {...pane}
        display="flex"
        flexDirection="column"
      >
        <Suspense fallback={<DetailSkeleton />}>
          <SelectedNote
            id={selectedId()}
            bucket={bucket()}
            assessed={overview.latest?.assessed}
            onDone={advance}
            onSkip={() => move(1)}
            onKeep={(id) => {
              advance();
              void keep(id);
            }}
          />
        </Suspense>
      </Box>
    </Grid>
  );
};

const SelectedNote: VoidComponent<{
  id: string | null;
  bucket: BucketId;
  assessed?: number;
  onDone: () => void;
  onSkip: () => void;
  onKeep: (docId: string) => void;
}> = (props) => {
  const item = createAsync(() =>
    props.id
      ? fetchCleanupItem(props.id, props.bucket)
      : Promise.resolve(null),
  );
  return (
    <Show
      when={item.latest}
      fallback={
        <Text fontSize="sm" color="fg.muted">
          <Show when={props.assessed === 0} fallback="Select a note to review.">
            No notes have been assessed yet. Set TYPESAFE_API_KEY (or
            CLEANUP_DECIDER=heuristic) and the sweep fills these queues.
          </Show>
        </Text>
      }
    >
      {(detail) => (
        <CleanupDetail
          item={detail()}
          onDone={props.onDone}
          onSkip={props.onSkip}
          onKeep={() => props.onKeep(detail().docId)}
        />
      )}
    </Show>
  );
};
