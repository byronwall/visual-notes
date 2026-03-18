import { Suspense, Show, createResource, For, type VoidComponent } from "solid-js";
import { ExternalLinkIcon } from "lucide-solid";
import { Box, HStack, Stack } from "styled-system/jsx";
import { openImagePreview } from "~/components/editor/ui/imagePreviewService";
import { SidePanel } from "~/components/SidePanel";
import { Button } from "~/components/ui/button";
import { CloseButton } from "~/components/ui/close-button";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { fetchArchivedPageDetail } from "~/services/archive/archive.service";
import { formatRelativeTime } from "~/features/docs-index/utils/time";

function truncateUrl(url: string, maxLength = 60) {
  if (url.length <= maxLength) return url;
  return `${url.slice(0, maxLength - 1)}…`;
}

function isDefinedMetaValue(value: unknown) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isImageUrl(value: string) {
  if (!isHttpUrl(value)) return false;
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(value);
}

function formatMetaValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.join(", ");
  return JSON.stringify(value);
}

function buildMetaSummaryRows(meta: Record<string, unknown> | null | undefined) {
  const rows: Array<{ keys: string[]; value: string }> = [];
  const seen = new Map<string, number>();

  for (const [key, value] of Object.entries(meta || {})) {
    if (key === "byName" || key === "byProperty" || !isDefinedMetaValue(value)) continue;
    const formatted = formatMetaValue(value);
    const existingIndex = seen.get(formatted);
    if (existingIndex != null) {
      rows[existingIndex]?.keys.push(key);
      continue;
    }
    seen.set(formatted, rows.length);
    rows.push({ keys: [key], value: formatted });
  }

  return rows;
}

export const ArchiveDetailDrawer: VoidComponent<{
  open: boolean;
  pageId?: string;
  onClose: () => void;
}> = (props) => {
  const [detail] = createResource(
    () => props.pageId,
    (id) => fetchArchivedPageDetail(id!),
  );

  return (
    <SidePanel
      open={props.open}
      onClose={props.onClose}
      ariaLabel="Archive item"
      width="min(96vw, 680px)"
    >
      <Box
        position="sticky"
        top="0"
        zIndex="10"
        px="4"
        py="4"
        borderBottomWidth="1px"
        borderColor="border"
        bg="linear-gradient(180deg, rgba(255,248,235,0.98), rgba(255,255,255,0.96))"
        backdropFilter="blur(10px)"
      >
        <HStack alignItems="flex-start" justify="space-between" gap="3">
          <Stack gap="1" flex="1" minW="0">
            <Text fontSize="2xl" fontWeight="semibold" lineHeight="1.1" lineClamp="1">
              {detail()?.title || "Archive item"}
            </Text>
            <HStack gap="2" alignItems="center" flexWrap="wrap">
              <Show when={detail()?.siteHostname}>
                {(host) => (
                  <Text
                    fontSize="xs"
                    fontFamily="mono"
                    color="fg.muted"
                    px="2"
                    py="1"
                    borderRadius="full"
                    bg="bg.subtle"
                  >
                    {host()}
                  </Text>
                )}
              </Show>
              <Show when={detail()?.groupName}>
                {(group) => (
                  <Text
                    fontSize="xs"
                    color="fg.muted"
                    px="2"
                    py="1"
                    borderRadius="full"
                    bg="bg.subtle"
                  >
                    {group()}
                  </Text>
                )}
              </Show>
              <Show when={detail()?.lastCapturedAt}>
                {(captured) => (
                  <Text fontSize="xs" color="fg.muted">
                    Updated {formatRelativeTime(captured())}
                  </Text>
                )}
              </Show>
            </HStack>
            <Show when={detail()?.originalUrl}>
              {(url) => (
                <HStack gap="2" alignItems="center" flexWrap="wrap">
                  <Link
                    href={url()}
                    target="_blank"
                    rel="noreferrer"
                    fontSize="sm"
                    color="fg.muted"
                    textDecoration="underline"
                    lineClamp="1"
                    maxW="420px"
                    title={url()}
                  >
                    {truncateUrl(url())}
                  </Link>
                  <Button
                    type="button"
                    size="xs"
                    variant="plain"
                    onClick={() => window.open(url(), "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLinkIcon size={12} />
                  </Button>
                </HStack>
              )}
            </Show>
          </Stack>
          <CloseButton aria-label="Close archive drawer" onClick={props.onClose} />
        </HStack>
      </Box>

      <Box px="4" py="4">
        <Suspense fallback={<Text color="fg.muted">Loading…</Text>}>
          <Show when={detail()} keyed>
            {(item) => (
              <Stack gap="5">
                {(() => {
                  const metaRows = buildMetaSummaryRows(
                    item.meta as Record<string, unknown> | null | undefined,
                  );

                  return (
                    <>
                <Stack gap="2">
                  <Text fontSize="sm" color="fg.muted">
                    Notes
                  </Text>
                  <Show
                    when={item.notes.length > 0}
                    fallback={<Text fontSize="sm" color="fg.muted">No notes yet.</Text>}
                  >
                    <Stack gap="1.5">
                      <For each={item.notes}>
                        {(note) => (
                          <HStack alignItems="baseline" gap="3" minW="0">
                            <Text
                              fontSize="xs"
                              color="fg.muted"
                              flexShrink="0"
                              minW="52px"
                            >
                              {formatRelativeTime(note.createdAt)}
                            </Text>
                            <Text
                              fontSize="sm"
                              color={note.noteText.trim() ? "fg.default" : "fg.muted"}
                              fontStyle={note.noteText.trim() ? "normal" : "italic"}
                              lineClamp="1"
                              minW="0"
                              flex="1"
                            >
                              {note.noteText.trim() || "Image capture"}
                            </Text>
                            <Show when={note.imageUrls.length > 0}>
                              <Text fontSize="xs" color="fg.muted" flexShrink="0">
                                {note.imageUrls.length} img
                              </Text>
                            </Show>
                            <Show when={note.snapshotId}>
                              <Text fontSize="xs" color="fg.muted" flexShrink="0">
                                snap
                              </Text>
                            </Show>
                          </HStack>
                        )}
                      </For>
                    </Stack>
                  </Show>
                </Stack>

                <Show
                  when={item.notes.some((note) => note.imageUrls.length > 0)}
                  fallback={null}
                >
                  <Stack gap="2">
                    <Text fontSize="sm" color="fg.muted">
                      Captures
                    </Text>
                    <Box display="flex" flexWrap="wrap" gap="3" alignItems="flex-start">
                      <For
                        each={item.notes.flatMap((note) =>
                          note.imageUrls.map((src) => ({
                            src,
                            noteId: note.id,
                            noteText: note.noteText,
                          })),
                        )}
                      >
                        {(image) => (
                          <Button
                            type="button"
                            variant="plain"
                            p="0"
                            h="auto"
                            w="auto"
                            maxW="full"
                            onClick={() =>
                              openImagePreview({
                                src: image.src,
                                alt: image.noteText,
                                title: "Archive capture",
                              })
                            }
                          >
                            <Box
                              p="2"
                              borderRadius="l3"
                              borderWidth="1px"
                              borderColor="border"
                              bg="bg.subtle"
                              maxW="min(100%, 420px)"
                            >
                              <img
                                src={image.src}
                                alt="Archive capture"
                              style={{
                                display: "block",
                                "max-width": "min(100%, 320px)",
                                "max-height": "320px",
                                width: "auto",
                                height: "auto",
                                margin: "0 auto",
                                  "border-radius": "12px",
                                }}
                              />
                            </Box>
                          </Button>
                        )}
                      </For>
                    </Box>
                  </Stack>
                </Show>

                <Show when={item.socialPreviewImageUrl}>
                  {(src) => (
                    <Stack gap="2">
                      <Text fontSize="sm" color="fg.muted">
                        Social preview
                      </Text>
                      <Box
                        borderRadius="l3"
                        overflow="hidden"
                        borderWidth="1px"
                        borderColor="border"
                        bg="bg.subtle"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        p="3"
                        minH="220px"
                      >
                        <img
                          src={src()}
                          alt={`${item.title} social preview`}
                          style={{
                            display: "block",
                            "max-width": "100%",
                            "max-height": "280px",
                            width: "auto",
                            height: "auto",
                          }}
                        />
                      </Box>
                    </Stack>
                  )}
                </Show>

                <Stack gap="2">
                  <Text fontSize="sm" color="fg.muted">
                    Latest HTML snippet
                  </Text>
                  <Box
                    as="pre"
                    p="3"
                    borderRadius="l2"
                    bg="bg.subtle"
                    fontSize="sm"
                    whiteSpace="pre-wrap"
                    wordBreak="break-word"
                    maxH="160px"
                    overflowY="auto"
                  >
                    {item.htmlSnippet}
                  </Box>
                </Stack>

                <Stack gap="2">
                  <Text fontSize="sm" color="fg.muted">
                    Meta summary
                  </Text>
                  <Show
                    when={metaRows.length > 0}
                    fallback={<Text fontSize="sm" color="fg.muted">No meta captured.</Text>}
                  >
                    <Box
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="l3"
                      overflow="hidden"
                      bg="bg.subtle"
                    >
                      <Box
                        as="table"
                        width="full"
                        fontSize="sm"
                        style={{ "table-layout": "fixed" }}
                      >
                        <Box as="tbody">
                          <For
                            each={metaRows}
                          >
                            {(row) => {
                              const label = row.keys.join(", ");
                              const isUrl = isHttpUrl(row.value);
                              const imageUrl = isImageUrl(row.value);

                              return (
                                <Box
                                  as="tr"
                                  borderTopWidth="1px"
                                  borderColor="border"
                                  _first={{ borderTopWidth: "0" }}
                                >
                                  <Box
                                    as="th"
                                    px="3"
                                    py="2.5"
                                    width="160px"
                                    textAlign="left"
                                    verticalAlign="top"
                                    color="fg.muted"
                                    fontSize="xs"
                                    fontWeight="semibold"
                                  >
                                    {label}
                                  </Box>
                                  <Box as="td" px="3" py="2.5" verticalAlign="top">
                                    <Show
                                      when={imageUrl}
                                      fallback={
                                        <Show
                                          when={isUrl}
                                          fallback={
                                            <Text
                                              fontSize="sm"
                                              color="fg.default"
                                              lineClamp="2"
                                              title={row.value}
                                              style={{ "word-break": "break-word" }}
                                            >
                                              {row.value}
                                            </Text>
                                          }
                                        >
                                          <Link
                                            href={row.value}
                                            target="_blank"
                                            rel="noreferrer"
                                            fontSize="sm"
                                            lineClamp="1"
                                            title={row.value}
                                          >
                                            {truncateUrl(row.value)}
                                          </Link>
                                        </Show>
                                      }
                                    >
                                      <Box display="flex" alignItems="flex-start">
                                        <img
                                          src={row.value}
                                          alt={label}
                                          style={{
                                            display: "block",
                                            "max-width": "100%",
                                            "max-height": "180px",
                                            width: "auto",
                                            height: "auto",
                                            "border-radius": "12px",
                                          }}
                                        />
                                      </Box>
                                    </Show>
                                  </Box>
                                </Box>
                              );
                            }}
                          </For>
                        </Box>
                      </Box>
                    </Box>
                    <Show
                      when={
                        Boolean((item.meta as Record<string, unknown> | null)?.byName) ||
                        Boolean((item.meta as Record<string, unknown> | null)?.byProperty)
                      }
                    >
                      <Box as="details">
                        <Box
                          as="summary"
                          cursor="pointer"
                          fontSize="sm"
                          color="fg.muted"
                        >
                          Raw meta maps
                        </Box>
                        <Stack gap="2" mt="2">
                          <Show when={(item.meta as Record<string, unknown> | null)?.byName}>
                            <Box p="3" borderRadius="l2" bg="bg.subtle" maxH="160px" overflowY="auto">
                              <Text fontSize="xs" color="fg.muted" mb="1">
                                byName
                              </Text>
                              <Text fontSize="sm" wordBreak="break-word">
                                {JSON.stringify(
                                  (item.meta as Record<string, unknown> | null)?.byName,
                                )}
                              </Text>
                            </Box>
                          </Show>
                          <Show when={(item.meta as Record<string, unknown> | null)?.byProperty}>
                            <Box p="3" borderRadius="l2" bg="bg.subtle" maxH="160px" overflowY="auto">
                              <Text fontSize="xs" color="fg.muted" mb="1">
                                byProperty
                              </Text>
                              <Text fontSize="sm" wordBreak="break-word">
                                {JSON.stringify(
                                  (item.meta as Record<string, unknown> | null)?.byProperty,
                                )}
                              </Text>
                            </Box>
                          </Show>
                        </Stack>
                      </Box>
                    </Show>
                  </Show>
                </Stack>

                <Stack gap="2">
                  <Text fontSize="sm" color="fg.muted">
                    Snapshot history
                  </Text>
                  <Stack gap="2">
                    <For each={item.snapshots}>
                      {(snapshot) => (
                        <Box p="3" borderRadius="l2" bg="bg.subtle">
                          <HStack justify="space-between" gap="3" alignItems="flex-start">
                            <Stack gap="1" minW="0">
                              <Text fontSize="sm" fontWeight="medium">
                                {snapshot.title || item.title}
                              </Text>
                              <Text fontSize="xs" color="fg.muted">
                                {snapshot.captureMode} · {formatRelativeTime(snapshot.capturedAt)}
                              </Text>
                              <Show when={snapshot.groupName}>
                                {(group) => (
                                  <Text fontSize="xs" color="fg.muted">
                                    Group: {group()}
                                  </Text>
                                )}
                              </Show>
                              <Show when={snapshot.textSnippet}>
                                {(snippet) => (
                                  <Text fontSize="sm" color="fg.muted" lineClamp="2">
                                    {snippet()}
                                  </Text>
                                )}
                              </Show>
                            </Stack>
                          </HStack>
                        </Box>
                      )}
                    </For>
                  </Stack>
                </Stack>
                    </>
                  );
                })()}
              </Stack>
            )}
          </Show>
        </Suspense>
      </Box>
    </SidePanel>
  );
};
