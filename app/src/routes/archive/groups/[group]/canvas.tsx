import { Meta, Title } from "@solidjs/meta";
import { A, createAsync, useParams } from "@solidjs/router";
import { ListIcon } from "lucide-solid";
import { Match, Suspense, Switch } from "solid-js";
import { Box, Stack, styled } from "styled-system/jsx";
import { button } from "styled-system/recipes";
import { ArchiveGroupCanvas } from "~/components/archive/ArchiveGroupCanvas";
import { ArchiveCanvasBreadcrumb } from "~/components/archive/canvas/ArchiveCanvasBreadcrumb";
import { Text } from "~/components/ui/text";
import {
  fetchArchiveGroupCanvasItems,
  fetchArchivedPageGroupSummaries,
  fetchArchivedPageGroups,
} from "~/services/archive/archive.service";

const RouterButtonLink = styled(A, button);

const ArchiveGroupCanvasRoute = () => {
  const params = useParams();
  const groupName = () => decodeURIComponent(params.group || "");
  const items = createAsync(() => fetchArchiveGroupCanvasItems(groupName()));
  const groups = createAsync(() => fetchArchivedPageGroups());
  const summaries = createAsync(() => fetchArchivedPageGroupSummaries());
  const pageTitle = () => `${groupName() || "Explorer"} Canvas • Visual Notes`;

  const breadcrumb = () => (
    <ArchiveCanvasBreadcrumb groupName={groupName()} groups={summaries.latest ?? []} />
  );
  const listLink = () => (
    <RouterButtonLink
      href={`/archive?group=${encodeURIComponent(groupName())}`}
      variant="plain"
      size="sm"
      title="Open this group as a list"
    >
      <ListIcon size={15} />
      <Box as="span" hideBelow="md">
        List
      </Box>
    </RouterButtonLink>
  );

  return (
    <Box as="main" h="100dvh" bg="bg.default" overflow="hidden">
      <Title>{pageTitle()}</Title>
      <Meta property="og:title" content={pageTitle()} />

      <Stack gap="2" h="full" minH="0" py="2.5" px={{ base: "2", md: "4" }}>
        <Suspense fallback={<Box flex="1" borderRadius="l3" bg="bg.subtle" />}>
          <Switch>
            <Match when={(items.latest ?? []).length > 0}>
              <ArchiveGroupCanvas
                groupName={groupName()}
                items={items.latest ?? []}
                groupOptions={groups.latest ?? []}
                toolbarPrefix={breadcrumb()}
                toolbarSuffix={listLink()}
              />
            </Match>
            <Match when={items.latest}>
              {breadcrumb()}
              <Stack gap="1" px="1" py="8" maxW="32rem">
                <Text fontWeight="medium">Nothing in {groupName()} yet</Text>
                <Text fontSize="sm" color="fg.muted">
                  Assign pages to this group from the Explorer list or the page details panel, and
                  they will appear here as cards.
                </Text>
                <Box mt="2">
                  <RouterButtonLink href="/archive" variant="outline" size="sm">
                    Back to Explorer
                  </RouterButtonLink>
                </Box>
              </Stack>
            </Match>
          </Switch>
        </Suspense>
      </Stack>
    </Box>
  );
};

export default ArchiveGroupCanvasRoute;
