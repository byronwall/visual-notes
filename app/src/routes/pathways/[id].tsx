import { Meta, Title } from "@solidjs/meta";
import { useParams } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { createResource, createSignal, Show, Suspense } from "solid-js";
import { PathwayPage } from "~/components/pathways/PathwayPage";
import { Skeleton } from "~/components/ui/skeleton";
import { Text } from "~/components/ui/text";
import { useAppChanges } from "~/features/live-sync/NoteLiveSyncProvider";
import type { PathwayView as PathwayRecord } from "~/server/pathways/pathway-tasks";
import { fetchPathway } from "~/services/pathways/pathways.queries";
import { forgetQuery } from "~/features/live-sync/forget-query";
import { keepOnFailedRead } from "~/utils/kept-async";

export default function PathwayRoute() {
  const params = useParams<{ id: string }>();
  const [refresh, setRefresh] = createSignal(0);
  const [record] = createResource<
    PathwayRecord | null | undefined,
    { id: string; refresh: number }
  >(
    () => ({ id: params.id, refresh: refresh() }),
    // A refresh that can't reach the server keeps the map on screen.
    (source, info) =>
      info.value?.id === source.id
        ? keepOnFailedRead(info.value, () => fetchPathway(source.id))
        : fetchPathway(source.id),
  );
  // Agent writes (MCP, another tab) refetch; the page merges the fresher copy.
  // The event arrives before the shared refresh clears the query cache, so
  // forget the cached map first, or the refetch reads the old one.
  const reload = () =>
    void forgetQuery(["pathway-get"]).then(() => setRefresh((n) => n + 1));
  useAppChanges("pathways", reload, (id) => id === params.id);
  // A task checked off on the Tasks page shows as done in Next steps.
  useAppChanges("tasks", reload);

  return (
    <Suspense fallback={<Skeleton h="9" w="18rem" m="8" />}>
      <Show
        when={record.latest}
        fallback={
          <Show when={record.state === "ready"}>
            <HttpStatusCode code={404} />
            <Title>Pathway not found • Visual Notes</Title>
            <Text p="10" fontSize="xl" fontWeight="semibold">
              Pathway not found
            </Text>
          </Show>
        }
      >
        {(r) => (
          <>
            <Title>{`${r().title} • Pathways`}</Title>
            <Meta property="og:title" content={`${r().title} • Pathways`} />
            {/* Unkeyed: a refetch hands the page a fresher record instead of remounting it. */}
            <PathwayPage record={r()} />
          </>
        )}
      </Show>
    </Suspense>
  );
}
