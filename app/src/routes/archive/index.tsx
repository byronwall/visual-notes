import { A, createAsync, useSearchParams } from "@solidjs/router";
import { Suspense, Show, createMemo, createSignal, For } from "solid-js";
import { ExternalLinkIcon } from "lucide-solid";
import { Box, Container, Grid, HStack, Stack, styled } from "styled-system/jsx";
import { button } from "styled-system/recipes";
import { ArchiveGroupCombobox } from "~/components/archive/ArchiveGroupCombobox";
import { ArchiveDetailDrawer } from "~/components/archive/ArchiveDetailDrawer";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Image } from "~/components/ui/image";
import { Link } from "~/components/ui/link";
import * as Table from "~/components/ui/table";
import { Text } from "~/components/ui/text";
import {
  fetchArchivedPageGroups,
  fetchArchivedPages,
} from "~/services/archive/archive.service";
import { formatRelativeTime } from "~/features/docs-index/utils/time";

function truncateUrl(url: string, maxLength = 60) {
  if (url.length <= maxLength) return url;
  return `${url.slice(0, maxLength - 1)}…`;
}

const RouterButtonLink = styled(A, button);

const ArchivePage = () => {
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = createSignal<string>();
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

  const updateFilter = (name: string, value: string) => {
    setParams({
      ...params,
      [name]: value || undefined,
    });
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default">
      <Container py="5" px="4" maxW="1280px">
        <Stack gap="5">
          <Stack
            gap="2"
            p={{ base: "4", md: "5" }}
            borderRadius="l3"
            bg="linear-gradient(135deg, rgba(255,248,235,1), rgba(255,255,255,0.96))"
            borderWidth="1px"
            borderColor="border"
            boxShadow="sm"
          >
            <Text fontSize={{ base: "2xl", md: "3xl" }} fontWeight="semibold">
              Archive
            </Text>
            <Text color="fg.muted" maxW="820px">
              Captured pages, grouped bulk imports, and targeted annotations from the
              Chrome extension.
            </Text>
          </Stack>

          <Stack
            gap="3"
            p="4"
            borderRadius="l3"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border"
          >
            <Grid
              gap="3"
              gridTemplateColumns={{ base: "1fr", md: "minmax(220px,1fr) minmax(220px,1fr) repeat(2, 180px) auto" }}
              alignItems="end"
            >
              <ArchiveGroupCombobox
                label="Group"
                value={readParam(params.group) || ""}
                options={groups() || []}
                placeholder="Filter by group"
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
                  Captured From
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
                  Captured To
                </Text>
                <Input
                  type="datetime-local"
                  value={readParam(params.capturedTo) || ""}
                  onInput={(event) => updateFilter("capturedTo", event.currentTarget.value)}
                />
              </Box>

              <Button
                variant="outline"
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
            <Show when={selectedGroup()}>
              <HStack justify="space-between" alignItems="center" flexWrap="wrap" gap="3">
                <Stack gap="1">
                  <Text fontSize="xs" color="fg.muted">
                    Selected group
                  </Text>
                  <RouterButtonLink
                    href={`/archive/groups/${encodeURIComponent(selectedGroup())}/canvas`}
                    variant="plain"
                    size="sm"
                    px="0"
                    justifyContent="flex-start"
                  >
                    {selectedGroup()}
                  </RouterButtonLink>
                </Stack>
                <RouterButtonLink
                  href={`/archive/groups/${encodeURIComponent(selectedGroup())}/canvas`}
                  variant="solid"
                  size="sm"
                >
                  Open Canvas
                </RouterButtonLink>
              </HStack>
            </Show>
          </Stack>

          <Suspense fallback={<Text color="fg.muted">Loading archive…</Text>}>
            <Show
              when={(items() || []).length > 0}
              fallback={
                <Box p="5" borderRadius="l3" bg="bg.subtle">
                  <Text color="fg.muted">No archive items match these filters.</Text>
                </Box>
              }
            >
              <Box
                borderRadius="l3"
                bg="bg.default"
                borderWidth="1px"
                borderColor="border"
                boxShadow="sm"
                overflow="hidden"
              >
                <Box overflowX="auto" overscrollBehaviorX="contain">
                  <Table.Root size="md">
                    <Table.Head>
                      <Table.Row>
                        <Table.Header>Preview</Table.Header>
                        <Table.Header>Title</Table.Header>
                        <Table.Header>Host</Table.Header>
                        <Table.Header>Group</Table.Header>
                        <Table.Header>Last captured</Table.Header>
                        <Table.Header>Notes</Table.Header>
                        <Table.Header>Snapshots</Table.Header>
                      </Table.Row>
                    </Table.Head>
                    <Table.Body>
                      <For each={items() || []}>
                        {(item) => (
                          <Table.Row
                            onClick={() => setSelectedId(item.id)}
                            style={{ cursor: "pointer" }}
                          >
                            <Table.Cell>
                              <Box
                                w="72px"
                                h="48px"
                                borderRadius="l2"
                                overflow="hidden"
                                bg="bg.subtle"
                                borderWidth="1px"
                                borderColor="border"
                              >
                                <Show
                                  when={item.previewImageUrl}
                                  fallback={
                                    <Box
                                      h="full"
                                      display="flex"
                                      alignItems="center"
                                      justifyContent="center"
                                    >
                                      <Text fontSize="xs" color="fg.muted">
                                        No image
                                      </Text>
                                    </Box>
                                  }
                                >
                                  {(src) => (
                                    <Image
                                      src={src()}
                                      alt={`${item.title} preview`}
                                      w="full"
                                      h="full"
                                      fit="contain"
                                      alignment="center"
                                    />
                                  )}
                                </Show>
                              </Box>
                            </Table.Cell>
                            <Table.Cell>
                              <Stack gap="1.5">
                                <Text fontWeight="medium">{item.title}</Text>
                                <HStack gap="2" alignItems="center" flexWrap="wrap">
                                  <Link
                                    href={item.originalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    fontSize="xs"
                                    color="fg.muted"
                                    textDecoration="underline"
                                    lineClamp="1"
                                    maxW="420px"
                                    title={item.originalUrl}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    {truncateUrl(item.originalUrl)}
                                  </Link>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="plain"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      window.open(item.originalUrl, "_blank", "noopener,noreferrer");
                                    }}
                                  >
                                    <ExternalLinkIcon size={12} />
                                  </Button>
                                </HStack>
                              </Stack>
                            </Table.Cell>
                            <Table.Cell>
                              <Text fontFamily="mono" fontSize="sm">
                                {item.siteHostname || "—"}
                              </Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Show
                                when={item.groupName}
                                fallback={<Text color="fg.muted">—</Text>}
                              >
                                {(groupName) => (
                                  <RouterButtonLink
                                    href={`/archive/groups/${encodeURIComponent(groupName())}/canvas`}
                                    variant="plain"
                                    size="sm"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    {groupName()}
                                  </RouterButtonLink>
                                )}
                              </Show>
                            </Table.Cell>
                            <Table.Cell>
                              {item.lastCapturedAt
                                ? formatRelativeTime(item.lastCapturedAt)
                                : "—"}
                            </Table.Cell>
                            <Table.Cell>{item.notesCount}</Table.Cell>
                            <Table.Cell>{item.snapshotsCount}</Table.Cell>
                          </Table.Row>
                        )}
                      </For>
                    </Table.Body>
                  </Table.Root>
                </Box>
              </Box>
            </Show>
          </Suspense>
        </Stack>
      </Container>

      <ArchiveDetailDrawer
        open={Boolean(selectedId())}
        pageId={selectedId()}
        onClose={() => setSelectedId(undefined)}
      />
    </Box>
  );
};

export default ArchivePage;
