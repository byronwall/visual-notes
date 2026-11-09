import { Meta, Title } from "@solidjs/meta";
import { Show, Suspense } from "solid-js";
import { Box } from "styled-system/jsx";
import { PathwaysIndex } from "~/components/pathways/PathwaysIndex";
import { Skeleton } from "~/components/ui/skeleton";
import { fetchPathways } from "~/services/pathways/pathways.queries";
import { createKeptAsync } from "~/utils/kept-async";

export default function PathwaysRoute() {
  // A query read, so live sync refreshes it; a failed refresh keeps the list.
  const items = createKeptAsync(() => fetchPathways());
  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Title>Pathways • Visual Notes</Title>
      <Meta
        name="description"
        content="Decision maps: options, where they lead, and the next steps worth doing."
      />
      <Suspense fallback={<Skeleton h="9" w="12rem" m="8" />}>
        <Show when={items.latest}>
          {(list) => <PathwaysIndex pathways={list()} />}
        </Show>
      </Suspense>
    </Box>
  );
}
