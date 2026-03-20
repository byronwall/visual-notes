import { Title } from "@solidjs/meta";
import { A, createAsync } from "@solidjs/router";
import { For, Show, Suspense, createMemo } from "solid-js";
import { Box, Container, Grid, HStack, Stack, styled } from "styled-system/jsx";
import { button, link } from "styled-system/recipes";
import { Link } from "~/components/ui/link";
import * as Table from "~/components/ui/table";
import { Text } from "~/components/ui/text";
import { fetchArchiveAdminSnapshots } from "~/services/archive/archive.service";
import { formatRelativeTime } from "~/features/docs-index/utils/time";

const RouterButtonLink = styled(A, button);
const RouterLink = styled(A, link);

function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ArchiveAdminRoute = () => {
  const snapshots = createAsync(() => fetchArchiveAdminSnapshots());
  const items = createMemo(() => snapshots.latest ?? snapshots() ?? []);
  const totalHtmlSize = createMemo(() =>
    items().reduce((sum, snapshot) => sum + (snapshot.htmlSizeBytes ?? 0), 0),
  );

  return (
    <Box as="main" minH="100vh" bg="bg.default">
      <Title>Explorer Admin • Visual Notes</Title>
      <Container py="4" px="4" maxW="1520px">
        <Stack gap="4">
          <Stack
            gap="3"
            p="4"
            borderRadius="l3"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border"
          >
            <HStack justify="space-between" gap="3" flexWrap="wrap">
              <Stack gap="0.5">
                <Text fontSize="2xl" fontWeight="semibold">
                  Explorer Admin
                </Text>
                <Text color="fg.muted" fontSize="sm" maxW="760px">
                  Inspect stored HTML snapshots, gauge saved payload sizes, review captured pages
                  in place, and download the temporary Chrome extension package.
                </Text>
              </Stack>
              <HStack gap="2" flexWrap="wrap">
                <RouterButtonLink href="/admin" variant="outline" size="sm">
                  Admin home
                </RouterButtonLink>
                <Link href="/api/archive/extension-package">Download Chrome extension</Link>
                <RouterButtonLink href="/admin/migrations" variant="outline" size="sm">
                  Image migrations
                </RouterButtonLink>
              </HStack>
            </HStack>

            <Grid
              gap="3"
              gridTemplateColumns={{ base: "1fr", md: "repeat(3, minmax(0, 1fr))" }}
            >
              <Stack gap="0.5" p="3" borderRadius="l3" bg="bg.default">
                <Text fontSize="xs" color="fg.muted">
                  Snapshots
                </Text>
                <Text fontSize="xl" fontWeight="semibold">
                  {items().length}
                </Text>
              </Stack>
              <Stack gap="0.5" p="3" borderRadius="l3" bg="bg.default">
                <Text fontSize="xs" color="fg.muted">
                  Stored HTML
                </Text>
                <Text fontSize="xl" fontWeight="semibold">
                  {formatBytes(totalHtmlSize())}
                </Text>
              </Stack>
              <Stack gap="0.5" p="3" borderRadius="l3" bg="bg.default">
                <Text fontSize="xs" color="fg.muted">
                  Review flow
                </Text>
                <Text fontSize="sm">
                  Use <strong>Review</strong> to inspect the saved HTML in place without downloading
                  it first.
                </Text>
              </Stack>
            </Grid>
          </Stack>

          <Suspense fallback={<Text color="fg.muted">Loading snapshots…</Text>}>
            <Show
              when={items().length > 0}
              fallback={<Text color="fg.muted">No snapshots available.</Text>}
            >
              <Box borderWidth="1px" borderColor="border" borderRadius="l3" overflow="hidden">
                <Box overflowX="auto" overscrollBehaviorX="contain">
                  <Table.Root>
                    <Table.Head>
                      <Table.Row>
                        <Table.Header minW="320px">Entry</Table.Header>
                        <Table.Header minW="160px">Captured</Table.Header>
                        <Table.Header minW="110px">Mode</Table.Header>
                        <Table.Header minW="160px">Group</Table.Header>
                        <Table.Header minW="180px">HTML Size</Table.Header>
                        <Table.Header minW="220px">Stored File</Table.Header>
                        <Table.Header minW="260px">Snippet</Table.Header>
                        <Table.Header minW="180px">Actions</Table.Header>
                      </Table.Row>
                    </Table.Head>
                    <Table.Body>
                      <For each={items()}>
                        {(snapshot) => (
                          <Table.Row>
                            <Table.Cell>
                              <Stack gap="1">
                                <Text fontWeight="medium">{snapshot.pageTitle}</Text>
                                <Link
                                  href={snapshot.originalUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  fontSize="xs"
                                  color="fg.muted"
                                  lineClamp="1"
                                >
                                  {snapshot.originalUrl}
                                </Link>
                              </Stack>
                            </Table.Cell>
                            <Table.Cell>
                              <Text fontSize="sm">{formatRelativeTime(snapshot.capturedAt)}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Text fontSize="sm">{snapshot.captureMode}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Text fontSize="sm">{snapshot.groupName || "—"}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Stack gap="1">
                                <Text fontSize="sm">{formatBytes(snapshot.htmlSizeBytes)}</Text>
                                <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                                  {snapshot.htmlHash?.slice(0, 12) || "—"}
                                </Text>
                              </Stack>
                            </Table.Cell>
                            <Table.Cell>
                              <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                                {snapshot.htmlPath || "—"}
                              </Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Text fontSize="sm" color="fg.muted" lineClamp="4">
                                {snapshot.textSnippet || "—"}
                              </Text>
                            </Table.Cell>
                            <Table.Cell>
                              <HStack gap="3" flexWrap="wrap">
                                <RouterLink href={`/admin/archive/snapshots/${snapshot.id}`}>
                                  Review
                                </RouterLink>
                                <Link href={`/api/archive/snapshots/${snapshot.id}/html?download=1`}>
                                  Download
                                </Link>
                              </HStack>
                            </Table.Cell>
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
    </Box>
  );
};

export default ArchiveAdminRoute;
