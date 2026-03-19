import { Title } from "@solidjs/meta";
import { A, createAsync } from "@solidjs/router";
import { For, Match, Show, Suspense, Switch } from "solid-js";
import { Box, Container, Grid, HStack, Stack, styled } from "styled-system/jsx";
import { button, link } from "styled-system/recipes";
import { Text } from "~/components/ui/text";
import {
  fetchArchiveCanvasOverviewGroups,
  type ArchivedPageCanvasOverviewGroup,
} from "~/services/archive/archive.service";
import { formatRelativeTime } from "~/features/docs-index/utils/time";

const RouterLink = styled(A, link);
const RouterButtonLink = styled(A, button);

const GroupPreview = (props: { group: ArchivedPageCanvasOverviewGroup }) => (
  <Box
    p="4"
    borderRadius="l3"
    borderWidth="1px"
    borderColor="border"
    bg="bg.default"
    boxShadow="sm"
  >
    <Stack gap="4">
      <Stack gap="2">
        <HStack justify="space-between" gap="3" alignItems="flex-start">
          <Stack gap="1" minW="0">
            <Text fontSize="lg" fontWeight="semibold" lineClamp="2">
              {props.group.name}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {props.group.count} captured {props.group.count === 1 ? "page" : "pages"}
            </Text>
          </Stack>
          <RouterButtonLink
            href={`/archive/groups/${encodeURIComponent(props.group.name)}/canvas`}
            size="sm"
          >
            Dig in
          </RouterButtonLink>
        </HStack>
        <Text fontSize="xs" color="fg.muted">
          {props.group.latestUpdatedAt
            ? `Updated ${formatRelativeTime(props.group.latestUpdatedAt)}`
            : "No recent updates"}
        </Text>
      </Stack>

      <Show when={props.group.previewImages.length > 0}>
        <Grid gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap="2">
          <For each={props.group.previewImages}>
            {(src) => (
              <Box
                aspectRatio="4 / 3"
                borderRadius="l2"
                overflow="hidden"
                bg="bg.subtle"
                borderWidth="1px"
                borderColor="border"
              >
                <img
                  src={src}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    "object-fit": "cover",
                    display: "block",
                  }}
                />
              </Box>
            )}
          </For>
        </Grid>
      </Show>

      <Stack gap="1.5">
        <Text fontSize="xs" color="fg.muted">
          Recent titles
        </Text>
        <For each={props.group.sampleTitles}>
          {(title) => (
            <Text fontSize="sm" lineClamp="1">
              {title}
            </Text>
          )}
        </For>
      </Stack>
    </Stack>
  </Box>
);

const ArchiveCanvasOverviewRoute = () => {
  const groups = createAsync(() => fetchArchiveCanvasOverviewGroups());

  return (
    <Box as="main" minH="100vh" bg="bg.default">
      <Title>Explorer Canvas Overview • Visual Notes</Title>
      <Container py="3" px={{ base: "3", md: "4" }} maxW="1440px">
        <Stack gap="4">
          <Stack
            gap="2"
            p={{ base: "3", md: "3.5" }}
            borderRadius="l3"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border"
          >
            <HStack justify="space-between" gap="3" flexWrap="wrap" alignItems="flex-start">
              <Stack gap="0.5">
                <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="semibold">
                  Groups overview
                </Text>
                <Text color="fg.muted" fontSize="sm">
                  Start zoomed out across all explorer groups, then dig into a single canvas.
                </Text>
              </Stack>
              <HStack gap="3">
                <RouterLink href="/archive">Back to Explorer</RouterLink>
              </HStack>
            </HStack>
          </Stack>

          <Suspense fallback={<Text color="fg.muted">Loading group overview…</Text>}>
            <Switch>
              <Match when={(groups() || []).length > 0}>
                <Grid
                  gap="4"
                  gridTemplateColumns={{
                    base: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                    xl: "repeat(3, minmax(0, 1fr))",
                  }}
                >
                  <For each={groups() || []}>
                    {(group) => <GroupPreview group={group} />}
                  </For>
                </Grid>
              </Match>
              <Match when={groups() && (groups() || []).length === 0}>
                <Box
                  p="5"
                  borderRadius="l3"
                  bg="bg.subtle"
                  borderWidth="1px"
                  borderColor="border"
                >
                  <Text color="fg.muted">No grouped explorer items yet.</Text>
                </Box>
              </Match>
            </Switch>
          </Suspense>
        </Stack>
      </Container>
    </Box>
  );
};

export default ArchiveCanvasOverviewRoute;
