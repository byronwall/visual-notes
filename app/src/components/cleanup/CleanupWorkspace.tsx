import { createAsync, useAction, useSearchParams } from "@solidjs/router";
import { Show, createMemo, type VoidComponent } from "solid-js";
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
import { BUCKET_META, RAIL_BUCKETS, type BucketId } from "./cleanup-buckets";
import { useCleanupKeys } from "./useCleanupKeys";

const pane = { minH: "0", overflowY: "auto" } as const;

/** Deep-pass triage: buckets, the selected bucket's queue, and one note. */
/** Daily stack or deep-pass triage, by `?mode=`. */
export const CleanupWorkspace: VoidComponent = () => {
  const [params] = useSearchParams();
  return (
    <Show when={params.mode === "daily"} fallback={<DeepPass />}>
      <DailyStack />
    </Show>
  );
};

const DeepPass: VoidComponent = () => {
  const [params, setParams] = useSearchParams();
  const overview = createAsync(() => fetchCleanupOverview());
  const bucket = createMemo<BucketId>(() => {
    const requested = params.bucket as BucketId;
    if (RAIL_BUCKETS.includes(requested)) return requested;
    const counts = overview()?.counts ?? {};
    return RAIL_BUCKETS.find((b) => (counts[b] ?? 0) > 0) ?? RAIL_BUCKETS[0];
  });
  const queue = createAsync(() => fetchCleanupQueue(bucket()));
  const ids = () => (queue() ?? []).map((item) => item.docId);
  const selectedId = () => {
    const requested = params.doc as string | undefined;
    return requested && ids().includes(requested)
      ? requested
      : ids()[0] ?? null;
  };
  const item = createAsync(() => {
    const id = selectedId();
    return id ? fetchCleanupItem(id, bucket()) : Promise.resolve(null);
  });
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
        <CleanupRail
          counts={overview()?.counts ?? {}}
          archived={overview()?.archived ?? 0}
          selected={bucket()}
          onSelect={(next) => setParams({ bucket: next, doc: undefined })}
        />
      </Stack>
      <Stack
        gap="0"
        borderRightWidth={{ md: "1px" }}
        borderColor="border"
        {...pane}
      >
        <Stack
          gap="1"
          px="3"
          py="4"
          borderBottomWidth="1px"
          borderColor="border"
        >
          <Text fontSize="md" fontWeight="semibold">
            {BUCKET_META[bucket()].label} · {queue()?.length ?? 0} notes
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {BUCKET_META[bucket()].blurb}
          </Text>
        </Stack>
        <CleanupQueueList
          items={queue() ?? []}
          selectedId={selectedId()}
          onSelect={select}
        />
      </Stack>
      <Box
        px={{ base: "4", md: "6" }}
        py="5"
        {...pane}
        display="flex"
        flexDirection="column"
      >
        <Show
          when={item()}
          fallback={
            <Text fontSize="sm" color="fg.muted">
              <Show
                when={overview() && overview()!.assessed === 0}
                fallback="Select a note to review."
              >
                No notes have been assessed yet. Set TYPESAFE_API_KEY (or
                CLEANUP_DECIDER=heuristic) and the sweep fills these queues.
              </Show>
            </Text>
          }
        >
          {(detail) => (
            <CleanupDetail
              item={detail()}
              onDone={advance}
              onSkip={() => move(1)}
              onKeep={() => {
                const id = detail().docId;
                advance();
                void keep(id);
              }}
            />
          )}
        </Show>
      </Box>
    </Grid>
  );
};
