import { Meta, Title } from "@solidjs/meta";
import { Show, Suspense, createResource } from "solid-js";
import { Box, Container } from "styled-system/jsx";
import { CollectionsIndex } from "~/components/collections/CollectionsIndex";
import { Skeleton } from "~/components/ui/skeleton";
import { fetchCollections } from "~/services/collections/collections.queries";

export default function CollectionsRoute() {
  const [items] = createResource(() => fetchCollections());
  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Title>Collections • Visual Notes</Title>
      <Meta name="description" content="Typed collections of notes, as tables, boards, galleries, and calendars." />
      <Container maxW="6xl" pt={{ base: "4", md: "6" }} pb="24" px={{ base: "4", md: "8" }}>
        <Suspense fallback={<Skeleton h="9" w="12rem" />}>
          <Show when={items.latest}>{(list) => <CollectionsIndex items={list()} />}</Show>
        </Suspense>
      </Container>
    </Box>
  );
}
