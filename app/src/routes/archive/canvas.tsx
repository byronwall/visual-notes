import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { For, Match, Switch } from "solid-js";
import { Box, Container, Grid, HStack } from "styled-system/jsx";
import { ArchiveGroupTile } from "~/components/archive/canvas/ArchiveGroupTile";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { fetchArchiveCanvasOverviewGroups } from "~/services/archive/archive.service";

const ArchiveCanvasOverviewRoute = () => {
  const groups = createAsync(() => fetchArchiveCanvasOverviewGroups());

  return (
    <Box as="main" minH="100vh" bg="bg.default">
      <Title>Canvases • Visual Notes</Title>
      <Container py={{ base: "3", md: "4" }} px={{ base: "3", md: "5" }} maxW="1200px">
        <HStack gap="2" alignItems="baseline" mb="3">
          <Link href="/archive" fontSize="sm" color="fg.muted" textDecoration="none" _hover={{ color: "fg.default" }}>
            Explorer
          </Link>
          <Text color="fg.subtle" fontSize="sm">
            ›
          </Text>
          <Text as="h1" fontSize={{ base: "xl", md: "2xl" }} fontWeight="semibold">
            Canvases
          </Text>
        </HStack>

        <Switch>
          <Match when={(groups.latest ?? []).length > 0}>
            <Grid
              gap="3"
              gridTemplateColumns={{
                base: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(3, minmax(0, 1fr))",
              }}
            >
              <For each={groups.latest}>{(group) => <ArchiveGroupTile group={group} />}</For>
            </Grid>
          </Match>
          <Match when={groups.latest}>
            <Box py="8" maxW="32rem">
              <Text fontWeight="medium">No groups yet</Text>
              <Text fontSize="sm" color="fg.muted" mt="1">
                Give a captured page a group in the Explorer and it gets its own canvas here.
              </Text>
            </Box>
          </Match>
          <Match when={true}>
            <Grid gap="3" gridTemplateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}>
              <For each={[0, 1, 2]}>{() => <Box h="15rem" borderRadius="l3" bg="bg.subtle" />}</For>
            </Grid>
          </Match>
        </Switch>
      </Container>
    </Box>
  );
};

export default ArchiveCanvasOverviewRoute;
