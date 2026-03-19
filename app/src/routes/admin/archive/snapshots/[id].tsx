import { Title } from "@solidjs/meta";
import { A, createAsync, useParams } from "@solidjs/router";
import { Show, Suspense } from "solid-js";
import { Box, Container, HStack, Stack, styled } from "styled-system/jsx";
import { button } from "styled-system/recipes";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { fetchArchiveAdminSnapshotDetail } from "~/services/archive/archive.service";
import { formatRelativeTime } from "~/features/docs-index/utils/time";

const RouterButtonLink = styled(A, button);

function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ArchiveSnapshotReviewRoute = () => {
  const params = useParams();
  const snapshot = createAsync(() => fetchArchiveAdminSnapshotDetail(String(params.id || "")));
  const item = () => snapshot.latest ?? snapshot();

  return (
    <Box as="main" minH="100vh" bg="bg.default">
      <Title>Explorer Snapshot Review • Visual Notes</Title>
      <Container py="4" px="4" maxW="1440px">
        <Stack gap="4">
          <HStack justify="space-between" gap="3" flexWrap="wrap">
            <HStack gap="2" flexWrap="wrap">
              <RouterButtonLink href="/admin/archive" variant="outline" size="sm">
                Back to Explorer Admin
              </RouterButtonLink>
              <Show when={item()}>
                {(current) => (
                  <Link href={`/api/archive/snapshots/${current().id}/html?download=1`}>
                    Download HTML
                  </Link>
                )}
              </Show>
            </HStack>
          </HStack>

          <Suspense fallback={<Text color="fg.muted">Loading snapshot…</Text>}>
            <Show when={item()}>
              {(current) => (
                <Stack gap="3">
                  <Stack
                    gap="1"
                    p="4"
                    borderRadius="l3"
                    bg="bg.subtle"
                    borderWidth="1px"
                    borderColor="border"
                  >
                    <Text fontSize="xl" fontWeight="semibold">
                      {current().pageTitle}
                    </Text>
                    <Link href={current().originalUrl} target="_blank" rel="noreferrer">
                      {current().originalUrl}
                    </Link>
                    <HStack gap="3" flexWrap="wrap">
                      <Text fontSize="sm" color="fg.muted">
                        {current().captureMode} · {formatRelativeTime(current().capturedAt)}
                      </Text>
                      <Text fontSize="sm" color="fg.muted">
                        HTML {formatBytes(current().htmlSizeBytes)}
                      </Text>
                      <Text fontSize="sm" color="fg.muted">
                        Group {current().groupName || "—"}
                      </Text>
                    </HStack>
                  </Stack>

                  <Box
                    h="75vh"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="l3"
                    overflow="hidden"
                    bg="bg.default"
                  >
                    <iframe
                      src={`/api/archive/snapshots/${current().id}/html`}
                      title="Explorer snapshot HTML"
                      sandbox="allow-same-origin"
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "0",
                        display: "block",
                      }}
                    />
                  </Box>
                </Stack>
              )}
            </Show>
          </Suspense>
        </Stack>
      </Container>
    </Box>
  );
};

export default ArchiveSnapshotReviewRoute;
