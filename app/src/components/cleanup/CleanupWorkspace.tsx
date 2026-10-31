import { createAsync, useAction, useSearchParams } from "@solidjs/router";
import { ChevronLeftIcon } from "lucide-solid";
import { Show, Suspense, createEffect, on, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Box, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
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

/**
 * One view at a time below `lg`, the queue and the note from `lg`, and the
 * buckets as a third column from `xl`. `data-detail` opens the note.
 */
const shell = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gridTemplateAreas: `"rail" "queue"`,
  bg: "bg.default",
  lg: {
    h: "100dvh",
    gridTemplateColumns: "300px minmax(0, 1fr)",
    gridTemplateRows: "auto minmax(0, 1fr)",
    gridTemplateAreas: `"rail rail" "queue detail"`,
  },
  xl: {
    gridTemplateColumns: "220px 320px minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
    gridTemplateAreas: `"rail queue detail"`,
  },
  lgDown: { "&[data-detail=true]": { gridTemplateAreas: `"detail"` } },
});

const hiddenWithDetail = {
  lgDown: { "[data-detail=true] &": { display: "none" } },
} as const;

const railPane = css(hiddenWithDetail, {
  gridArea: "rail",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  columnGap: "3",
  rowGap: "2",
  px: "4",
  py: { base: "3", xl: "5" },
  borderBottomWidth: "1px",
  borderColor: "border",
  xl: {
    flexDirection: "column",
    flexWrap: "nowrap",
    alignItems: "stretch",
    rowGap: "4",
    borderBottomWidth: "0",
    borderRightWidth: "1px",
    minH: "0",
    overflowY: "auto",
  },
});

const queuePane = css(hiddenWithDetail, {
  gridArea: "queue",
  display: "flex",
  flexDirection: "column",
  minH: "0",
  lg: { borderRightWidth: "1px", borderColor: "border", overflowY: "auto" },
});

const detailPane = css({
  gridArea: "detail",
  display: "flex",
  flexDirection: "column",
  gap: "2",
  minW: "0",
  minH: "0",
  px: { base: "4", md: "6" },
  py: { base: "3", lg: "5" },
  lg: { overflowY: "auto" },
  lgDown: {
    display: "none",
    "[data-detail=true] &": { display: "flex" },
  },
});

/** The width where the queue and the note show side by side. */
const isWide = () => window.matchMedia("(min-width: 1024px)").matches;

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
  // A deep link may name a note past the rows this list shows.
  const selectedId = () =>
    (params.doc as string | undefined) ?? ids()[0] ?? null;
  /** Rows differ in confidence, so the number tells this note apart. */
  const confidenceVaries = () =>
    new Set((queue.latest?.rows ?? []).map((row) => row.confidence)).size > 1;
  const keep = useAction(keepNoteAction);
  let list: HTMLDivElement | undefined;
  let backButton: HTMLButtonElement | undefined;

  const select = (docId: string | null) => {
    setParams({ doc: docId ?? undefined }, { replace: true });
    if (docId) {
      document
        .getElementById(`cleanup-row-${docId}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  };
  /** A tap below `lg` opens a new view, so the browser's Back can close it. */
  const open = (docId: string) => {
    if (isWide()) select(docId);
    else setParams({ doc: docId });
  };
  const closeNote = () => setParams({ doc: undefined });

  // Below `lg` the view changes under the finger. Start each note at its top
  // with focus inside it, and return to the row when the note closes.
  createEffect(
    on(
      () => params.doc as string | undefined,
      (doc, previous) => {
        if (isWide()) return;
        if (doc) {
          window.scrollTo(0, 0);
          backButton?.focus({ preventScroll: true });
        } else if (previous) {
          const row = document.getElementById(`cleanup-row-${previous}`);
          row?.scrollIntoView({ block: "center" });
          row?.focus({ preventScroll: true });
        }
      },
      { defer: true },
    ),
  );

  const move = (delta: number) => {
    const list = ids();
    if (!list.length) return;
    const index = Math.max(0, list.indexOf(selectedId() ?? ""));
    select(list[Math.min(list.length - 1, Math.max(0, index + delta))]);
  };
  // A finished note is gone from `ids()` by the time its action returns, so
  // remember where it stood.
  let position = 0;
  createEffect(() => {
    const index = ids().indexOf(selectedId() ?? "");
    if (index >= 0) position = index;
  });
  /** After a note leaves the queue, select its neighbor. */
  const advance = (docId: string) => {
    const rows = ids();
    const index = rows.indexOf(docId);
    select(
      index < 0
        ? rows[Math.min(position, rows.length - 1)] ?? null
        : rows[index + 1] ?? rows[index - 1] ?? null,
    );
    // The button that had focus went with the note.
    list?.focus({ preventScroll: true });
  };
  useCleanupKeys(move);
  const onBucket = (next: BucketId) =>
    setParams({ bucket: next, doc: undefined });

  return (
    <main class={shell} data-detail={params.doc ? "true" : undefined}>
      <div class={railPane}>
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
      </div>
      <div class={queuePane}>
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
            onSelect={open}
            ref={(el) => (list = el)}
          />
        </Suspense>
      </div>
      <div class={detailPane}>
        <Box display={{ lg: "none" }}>
          <Button
            ref={(el: HTMLButtonElement) => (backButton = el)}
            size="sm"
            variant="plain"
            ml="-2"
            onClick={closeNote}
          >
            <ChevronLeftIcon />
            Back to the queue
          </Button>
        </Box>
        <Suspense fallback={<DetailSkeleton />}>
          <SelectedNote
            id={selectedId()}
            bucket={bucket()}
            assessed={overview.latest?.assessed}
            showConfidence={confidenceVaries()}
            onDone={advance}
            onSkip={() => move(1)}
            onKeep={(id) => {
              advance(id);
              void keep(id);
            }}
          />
        </Suspense>
      </div>
    </main>
  );
};

const SelectedNote: VoidComponent<{
  id: string | null;
  bucket: BucketId;
  assessed?: number;
  showConfidence: boolean;
  onDone: (docId: string) => void;
  onSkip: () => void;
  onKeep: (docId: string) => void;
}> = (props) => {
  const item = createAsync(() =>
    props.id ? fetchCleanupItem(props.id, props.bucket) : Promise.resolve(null),
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
          showConfidence={props.showConfidence}
          onDone={() => props.onDone(detail().docId)}
          onSkip={props.onSkip}
          onKeep={() => props.onKeep(detail().docId)}
        />
      )}
    </Show>
  );
};
