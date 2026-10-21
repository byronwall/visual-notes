import { Meta, Title } from "@solidjs/meta";
import { useParams } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { Show, Suspense, createResource, createSignal } from "solid-js";
import { Box, Container } from "styled-system/jsx";
import { CollectionPage } from "~/components/collections/CollectionPage";
import { Skeleton } from "~/components/ui/skeleton";
import { Text } from "~/components/ui/text";
import { fetchCollectionBundle } from "~/services/collections/collections.queries";
import { useAppChanges } from "~/features/live-sync/NoteLiveSyncProvider";

export default function CollectionRoute() {
  const params = useParams();
  const [refresh, setRefresh] = createSignal(0);
  const [bundle] = createResource(
    () => ({ id: params.id, refresh: refresh() }),
    (source) => fetchCollectionBundle(source.id),
  );
  // Agent writes reconcile into the page's store like any fresh bundle.
  useAppChanges("collections", () => setRefresh((n) => n + 1), (id) => id === params.id);

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container maxW="none" pt={{ base: "3", md: "5" }} pb="24" px={{ base: "4", md: "8" }}>
        <Suspense fallback={<Skeleton h="9" w="18rem" />}>
          <Show
            when={bundle.latest}
            fallback={
              <Show when={bundle.state === "ready"}>
                <HttpStatusCode code={404} />
                <Title>Collection not found • Visual Notes</Title>
                <Text pt="10" fontSize="xl" fontWeight="semibold">
                  Collection not found
                </Text>
              </Show>
            }
          >
            {(b) => (
              <>
                <Title>{`${b().collection.name} • Visual Notes`}</Title>
                <Meta property="og:title" content={`${b().collection.name} • Visual Notes`} />
                <CollectionPage bundle={b()} />
              </>
            )}
          </Show>
        </Suspense>
      </Container>
    </Box>
  );
}
