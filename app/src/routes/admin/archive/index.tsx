import { Title } from "@solidjs/meta";
import { A, createAsync } from "@solidjs/router";
import { For, Show, Suspense } from "solid-js";
import { Box, Container, HStack, Stack, styled } from "styled-system/jsx";
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
  const items = () => snapshots.latest ?? snapshots() ?? [];

  return (
    <Box as="main" minH="100vh" bg="bg.default">
      <Title>Explorer Admin • Visual Notes</Title>
      <Container py="4" px="4" maxW="1360px">
        <Stack gap="4">
          <Stack
            gap="2"
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
                <Text color="fg.muted" fontSize="sm">
                  Inspect stored HTML snapshots, review what was captured, and download the local Chrome extension package.
                </Text>
              </Stack>
              <HStack gap="2" flexWrap="wrap">
                <Link href="/api/archive/extension-package">Download Chrome extension</Link>
                <RouterButtonLink href="/admin/migrations" variant="outline" size="sm">
                  Image migrations
                </RouterButtonLink>
              </HStack>
            </HStack>
          </Stack>

          <Suspense fallback={<Text color="fg.muted">Loading snapshots…</Text>}>
            <Show
              when={items().length > 0}
              fallback={<Text color="fg.muted">No snapshots available.</Text>}
            >
              <Box borderWidth="1px" borderColor="border" borderRadius="l3" overflow="hidden">
                <Box overflowX="auto">
                  <Table.Root>
                    <Table.Head>
                      <Table.Row>
                        <Table.Header>Entry</Table.Header>
                        <Table.Header>Captured</Table.Header>
                        <Table.Header>Mode</Table.Header>
                        <Table.Header>Group</Table.Header>
                        <Table.Header>HTML</Table.Header>
                        <Table.Header>Actions</Table.Header>
                      </Table.Row>
                    </Table.Head>
                    <Table.Body>
                      <For each={items()}>
                        {(snapshot) => (
                          <Table.Row>
                            <Table.Cell minW="340px">
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
                                <Show when={snapshot.textSnippet}>
                                  {(snippet) => (
                                    <Text fontSize="sm" color="fg.muted" lineClamp="2">
                                      {snippet()}
                                    </Text>
                                  )}
                                </Show>
                              </Stack>
                            </Table.Cell>
                            <Table.Cell>{formatRelativeTime(snapshot.capturedAt)}</Table.Cell>
                            <Table.Cell>{snapshot.captureMode}</Table.Cell>
                            <Table.Cell>{snapshot.groupName || "—"}</Table.Cell>
                            <Table.Cell>
                              <Stack gap="1">
                                <Text fontSize="sm">{formatBytes(snapshot.htmlSizeBytes)}</Text>
                                <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                                  {snapshot.htmlHash?.slice(0, 12) || "—"}
                                </Text>
                              </Stack>
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
