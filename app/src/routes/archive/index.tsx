import { Title } from "@solidjs/meta";
import { A, createAsync, revalidate, useAction, useSearchParams } from "@solidjs/router";
import { Match, Show, Suspense, Switch, createMemo, createSignal, For } from "solid-js";
import { Box, Container, Grid, HStack, Stack, styled } from "styled-system/jsx";
import { button } from "styled-system/recipes";
import { ArchiveDetailDrawer } from "~/components/archive/ArchiveDetailDrawer";
import { ArchiveFavicon } from "~/components/archive/ArchiveFavicon";
import { ArchiveGroupCombobox } from "~/components/archive/ArchiveGroupCombobox";
import { ArchiveGroupSwitcher } from "~/components/archive/ArchiveGroupSwitcher";
import { ArchivePreviewStack } from "~/components/archive/ArchivePreviewStack";
import { InPlaceEditableText } from "~/components/InPlaceEditableText";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import * as Table from "~/components/ui/table";
import {
  deleteArchivedPage,
  updateArchivedPage,
} from "~/services/archive/archive.actions";
import {
  fetchArchivedPageDetail,
  fetchArchivedPageGroupSummaries,
  fetchArchivedPageGroups,
  fetchArchivedPages,
} from "~/services/archive/archive.service";
import { formatRelativeTime } from "~/features/docs-index/utils/time";

const RouterButtonLink = styled(A, button);

function truncateUrl(url: string, maxLength = 72) {
  if (url.length <= maxLength) return url;
  return `${url.slice(0, maxLength - 1)}…`;
}

const ArchivePage = () => {
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = createSignal<string>();
  const runUpdateArchivedPage = useAction(updateArchivedPage);
  const runDeleteArchivedPage = useAction(deleteArchivedPage);

  const readParam = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const filters = createMemo(() => ({
    group: readParam(params.group) || undefined,
    hostname: readParam(params.hostname) || undefined,
    capturedFrom: readParam(params.capturedFrom) || undefined,
    capturedTo: readParam(params.capturedTo) || undefined,
  }));
  const selectedGroup = createMemo(() => readParam(params.group) || "");

  const items = createAsync(() => fetchArchivedPages(filters()));
  const groups = createAsync(() => fetchArchivedPageGroups());
  const groupSummaries = createAsync(() => fetchArchivedPageGroupSummaries());

  const itemList = createMemo(() => items.latest ?? items() ?? []);
  const groupList = createMemo(() => groups.latest ?? groups() ?? []);
  const topGroups = createMemo(() => (groupSummaries.latest ?? groupSummaries() ?? []).slice(0, 12));

  const updateFilter = (name: string, value: string) => {
    setParams({
      ...params,
      [name]: value || undefined,
    });
  };

  const refreshData = async (pageId?: string) => {
    await Promise.all([
      revalidate(fetchArchivedPages.keyFor(filters())),
      revalidate(fetchArchivedPageGroups.key),
      revalidate(fetchArchivedPageGroupSummaries.key),
      ...(pageId ? [revalidate(fetchArchivedPageDetail.keyFor(pageId))] : []),
    ]);
  };

  const handleTitleCommit = async (id: string, title: string) => {
    await runUpdateArchivedPage({ id, title });
    await refreshData(id);
  };

  const handleGroupCommit = async (id: string, groupName: string) => {
    await runUpdateArchivedPage({ id, groupName });
    await refreshData(id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this explorer entry and its snapshots/notes?")) return;
    await runDeleteArchivedPage({ id });
    if (selectedId() === id) setSelectedId(undefined);
    await refreshData();
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default">
      <Title>Explorer • Visual Notes</Title>
      <Container py="3" px={{ base: "3", md: "4" }} maxW="1440px">
        <Stack gap="3">
          <Stack
            gap="2"
            p={{ base: "3", md: "3.5" }}
            borderRadius="l3"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border"
          >
            <HStack justify="space-between" alignItems="flex-start" gap="3" flexWrap="wrap">
              <Stack gap="0.5">
                <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="semibold">
                  Explorer
                </Text>
                <Text color="fg.muted" fontSize="sm">
                  Captured pages, snapshots, notes, and group jumps into canvas.
                </Text>
              </Stack>
              <Show when={selectedGroup()}>
                <RouterButtonLink
                  href={`/archive/groups/${encodeURIComponent(selectedGroup())}/canvas`}
                  variant="solid"
                  size="sm"
                >
                  Open {selectedGroup()} canvas
                </RouterButtonLink>
              </Show>
            </HStack>

            <Show when={topGroups().length > 0}>
              <HStack gap="2" flexWrap="wrap">
                <For each={topGroups()}>
                  {(group) => (
                    <RouterButtonLink
                      href={`/archive/groups/${encodeURIComponent(group.name)}/canvas`}
                      variant={selectedGroup() === group.name ? "solid" : "outline"}
                      size="xs"
                    >
                      {group.name} ({group.count})
                    </RouterButtonLink>
                  )}
                </For>
              </HStack>
            </Show>
          </Stack>

          <Stack
            gap="2"
            p="3"
            borderRadius="l3"
            bg="bg.default"
            borderWidth="1px"
            borderColor="border"
          >
            <Grid
              gap="2"
              gridTemplateColumns={{
                base: "1fr",
                lg: "minmax(220px, 0.9fr) minmax(220px, 0.8fr) repeat(2, 180px) auto",
              }}
              alignItems="end"
            >
              <ArchiveGroupCombobox
                label="Filter group"
                value={readParam(params.group) || ""}
                options={groupList()}
                placeholder="All groups"
                onChange={(value) => updateFilter("group", value)}
              />

              <Box minW="0">
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Hostname
                </Text>
                <Input
                  value={readParam(params.hostname) || ""}
                  onInput={(event) => updateFilter("hostname", event.currentTarget.value)}
                  placeholder="example.com"
                />
              </Box>

              <Box minW="0">
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Captured from
                </Text>
                <Input
                  type="datetime-local"
                  value={readParam(params.capturedFrom) || ""}
                  onInput={(event) =>
                    updateFilter("capturedFrom", event.currentTarget.value)
                  }
                />
              </Box>

              <Box minW="0">
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Captured to
                </Text>
                <Input
                  type="datetime-local"
                  value={readParam(params.capturedTo) || ""}
                  onInput={(event) => updateFilter("capturedTo", event.currentTarget.value)}
                />
              </Box>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setParams({
                    group: undefined,
                    hostname: undefined,
                    capturedFrom: undefined,
                    capturedTo: undefined,
                  })
                }
              >
                Clear
              </Button>
            </Grid>
          </Stack>

          <Suspense fallback={<Text color="fg.muted">Loading explorer…</Text>}>
            <Switch>
              <Match when={itemList().length > 0}>
                <Box
                  borderRadius="l3"
                  bg="bg.default"
                  borderWidth="1px"
                  borderColor="border"
                  overflow="hidden"
                >
                  <Box overflowX="auto" overscrollBehaviorX="contain">
                    <Table.Root>
                      <Table.Head>
                        <Table.Row>
                          <Table.Header>Preview</Table.Header>
                          <Table.Header>Entry</Table.Header>
                          <Table.Header>Host</Table.Header>
                          <Table.Header>Group</Table.Header>
                          <Table.Header>Updated</Table.Header>
                          <Table.Header>Actions</Table.Header>
                        </Table.Row>
                      </Table.Head>
                      <Table.Body>
                        <For each={itemList()}>
                          {(item) => (
                            <Table.Row
                              onClick={() => setSelectedId(item.id)}
                              bg={selectedId() === item.id ? "bg.subtle" : undefined}
                              transitionProperty="background-color"
                              transitionDuration="normal"
                              _hover={{ bg: "bg.subtle" }}
                              style={{ cursor: "pointer" }}
                            >
                              <Table.Cell>
                                <ArchivePreviewStack
                                  images={item.previewImageUrls}
                                  title={item.title}
                                />
                              </Table.Cell>
                              <Table.Cell minW="360px">
                                <Stack gap="1.5" maxW="400px">
                                  <HStack gap="2" minW="0" alignItems="center">
                                    <ArchiveFavicon src={item.faviconUrl} title={item.title} />
                                    <Box minW="0" flex="1" maxW="calc(400px - 26px)">
                                      <InPlaceEditableText
                                        value={item.title}
                                        onCommit={(value) => handleTitleCommit(item.id, value)}
                                        activationMode="dblclick"
                                        fillWidth
                                        truncatePreview
                                        minInputWidth="18rem"
                                      />
                                    </Box>
                                  </HStack>
                                  <Show when={item.description}>
                                    {(description) => (
                                      <Text
                                        fontSize="sm"
                                        color="fg.muted"
                                        lineClamp="2"
                                        maxW="400px"
                                      >
                                        {description()}
                                      </Text>
                                    )}
                                  </Show>
                                  <Link
                                    href={item.originalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    fontSize="xs"
                                    color="fg.muted"
                                    textDecoration="underline"
                                    lineClamp="1"
                                    maxW="400px"
                                    borderRadius="l1"
                                    px="1"
                                    py="0.5"
                                    title={item.originalUrl}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    {truncateUrl(item.originalUrl)}
                                  </Link>
                                </Stack>
                              </Table.Cell>
                              <Table.Cell>
                                <Text fontFamily="mono" fontSize="sm">
                                  {item.siteHostname || "—"}
                                </Text>
                              </Table.Cell>
                              <Table.Cell minW="220px">
                                <ArchiveGroupSwitcher
                                  value={item.groupName || ""}
                                  options={groupList()}
                                  canvasHref={
                                    item.groupName
                                      ? `/archive/groups/${encodeURIComponent(item.groupName)}/canvas`
                                      : undefined
                                  }
                                  onCommit={(groupName) => handleGroupCommit(item.id, groupName)}
                                />
                              </Table.Cell>
                              <Table.Cell>
                                {item.lastCapturedAt
                                  ? formatRelativeTime(item.lastCapturedAt)
                                  : "—"}
                              </Table.Cell>
                              <Table.Cell onClick={(event) => event.stopPropagation()}>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="subtle"
                                  colorPalette="red"
                                  onClick={() => void handleDelete(item.id)}
                                >
                                  Delete
                                </Button>
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </For>
                      </Table.Body>
                    </Table.Root>
                  </Box>
                </Box>
              </Match>
              <Match when={items() && itemList().length === 0}>
                <Box p="5" borderRadius="l3" bg="bg.subtle">
                  <Text color="fg.muted">No explorer items match these filters.</Text>
                </Box>
              </Match>
            </Switch>
          </Suspense>
        </Stack>
      </Container>

      <ArchiveDetailDrawer
        open={Boolean(selectedId())}
        pageId={selectedId()}
        groupOptions={groupList()}
        onClose={() => setSelectedId(undefined)}
        onChanged={(pageId) => void refreshData(pageId)}
        onDeleted={(pageId) => {
          if (selectedId() === pageId) setSelectedId(undefined);
          void refreshData();
        }}
      />
    </Box>
  );
};

export default ArchivePage;
