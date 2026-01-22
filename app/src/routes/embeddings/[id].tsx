import {
  type VoidComponent,
  For,
  Show,
  Suspense,
  createSignal,
} from "solid-js";
import { createAsync, revalidate, useAction, useNavigate, useParams } from "@solidjs/router";
import { createStore } from "solid-js/store";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { Box, Container, Flex, Grid, HStack, Stack } from "styled-system/jsx";
import { fetchDocSections, fetchEmbeddingRun } from "~/services/embeddings/embeddings.queries";
import { deleteEmbeddingRun, processEmbeddingRun } from "~/services/embeddings/embeddings.actions";
import { createUmapRun } from "~/services/umap/umap.actions";

type EmbeddingRun = {
  id: string;
  model: string;
  dims: number;
  params: Record<string, unknown> | null;
  createdAt: string;
  count: number;
  sectionCount?: number;
  remaining?: number;
  changedEligible?: number;
  docs?: {
    items: { id: string; title: string; embeddedAt: string }[];
    limit: number;
    offset: number;
  };
};

const DOCS_LIMIT = 50;


type SectionItem = {
  id: string;
  headingPath: string[];
  orderIndex: number;
  charCount: number;
  preview: string;
  embedded?: boolean;
};

const EmbeddingDetail: VoidComponent = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [docsOffset, setDocsOffset] = createSignal(0);
  const run = createAsync(() => {
    if (!params.id) return Promise.resolve<EmbeddingRun | null>(null);
    return fetchEmbeddingRun({
      id: params.id,
      includeDocs: true,
      limit: DOCS_LIMIT,
      offset: docsOffset(),
    }) as Promise<EmbeddingRun | null>;
  });
  const runDeleteEmbedding = useAction(deleteEmbeddingRun);
  const runCreateUmap = useAction(createUmapRun);
  const runProcessEmbedding = useAction(processEmbeddingRun);
  const [busy, setBusy] = createSignal(false);
  const [state, setState] = createStore({
    dims: 2 as 2 | 3,
    batchSize: 200,
    selectedDocId: null as string | null,
    sections: [] as SectionItem[],
  });

  const includedRangeLabel = () => {
    const r = run();
    if (!r?.docs) return "";
    const start = (r.docs.offset || 0) + 1;
    const end = (r.docs.offset || 0) + (r.docs.items?.length || 0);
    return `Showing ${start}-${end} of ${r.count}`;
  };

  const hasPrev = () => (run()?.docs?.offset || 0) > 0;
  const hasNext = () => {
    const off = run()?.docs?.offset || 0;
    const len = run()?.docs?.items?.length || 0;
    return off + len < (run()?.count || 0);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this embedding run?")) return;
    try {
      setBusy(true);
      console.log("[EmbeddingDetail] deleteRun", { id: params.id });
      await runDeleteEmbedding({ id: params.id });
      navigate("/embeddings");
    } catch (e) {
      console.error(e);
      alert("Failed to delete run");
    } finally {
      setBusy(false);
    }
  };

  const handleStartUmap = async () => {
    try {
      setBusy(true);
      console.log("[EmbeddingDetail] startUmap", {
        embeddingRunId: params.id,
        dims: state.dims,
      });
      const r = await runCreateUmap({
        embeddingRunId: params.id,
        dims: state.dims,
      });
      navigate(`/umap/${r.runId}`);
    } catch (e) {
      console.error(e);
      alert("Failed to start UMAP run");
    } finally {
      setBusy(false);
    }
  };

  const handleProcessMore = async () => {
    try {
      setBusy(true);
      console.log("[EmbeddingDetail] processMore", {
        id: params.id,
        limit: state.batchSize,
      });
      await runProcessEmbedding({ id: params.id, limit: state.batchSize });
      await revalidate(
        fetchEmbeddingRun.keyFor({
          id: params.id,
          includeDocs: true,
          limit: DOCS_LIMIT,
          offset: docsOffset(),
        })
      );
    } catch (e) {
      console.error(e);
      alert("Failed to process more notes");
    } finally {
      setBusy(false);
    }
  };

  const handleProcessChanged = async () => {
    try {
      setBusy(true);
      console.log("[EmbeddingDetail] processChanged", {
        id: params.id,
        limit: state.batchSize,
      });
      await runProcessEmbedding({
        id: params.id,
        limit: state.batchSize,
        mode: "changed",
      });
      await revalidate(
        fetchEmbeddingRun.keyFor({
          id: params.id,
          includeDocs: true,
          limit: DOCS_LIMIT,
          offset: docsOffset(),
        })
      );
    } catch (e) {
      console.error(e);
      alert("Failed to process changed notes");
    } finally {
      setBusy(false);
    }
  };

  const handlePrev = () => {
    setDocsOffset(Math.max(0, (run()?.docs?.offset || 0) - DOCS_LIMIT));
  };

  const handleNext = () => {
    setDocsOffset((run()?.docs?.offset || 0) + DOCS_LIMIT);
  };

  const handleLoadSections = async (docId: string) => {
    setState("selectedDocId", docId);
    setState("sections", []);
    try {
      console.log("[EmbeddingDetail] loadSections", { docId, runId: params.id });
      const items = await fetchDocSections({ docId, runId: params.id });
      setState("sections", items || []);
    } catch (e) {
      console.error(e);
      alert("Failed to load sections");
    }
  };

  const handleOpenDoc = (docId: string) => {
    navigate(`/docs/${docId}`);
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="4" px="4" maxW="1200px">
        <Stack gap="6">
          <Flex align="center" justify="space-between" gap="4" flexWrap="wrap">
            <Stack gap="1">
              <Heading as="h1" fontSize="2xl">
                Embedding Run
              </Heading>
              <Suspense
                fallback={
                  <Text textStyle="sm" color="fg.muted">
                    Loading…
                  </Text>
                }
              >
                <Show when={run()}>
                  {(r) => (
                    <Stack gap="1" fontSize="sm" color="fg.muted">
                      <Box>
                        <Box as="span" fontWeight="semibold" color="fg.default">
                          ID:
                        </Box>{" "}
                        {r().id}
                      </Box>
                      <Box>
                        <Box as="span" fontWeight="semibold" color="fg.default">
                          Model:
                        </Box>{" "}
                        {r().model}
                      </Box>
                      <Box>
                        <Box as="span" fontWeight="semibold" color="fg.default">
                          Dims:
                        </Box>{" "}
                        {r().dims}
                      </Box>
                      <Box>
                        <Box as="span" fontWeight="semibold" color="fg.default">
                          Embeddings:
                        </Box>{" "}
                        {r().count}
                      </Box>
                      <Show when={r().sectionCount !== undefined}>
                        <Box>
                          <Box
                            as="span"
                            fontWeight="semibold"
                            color="fg.default"
                          >
                            Sections:
                          </Box>{" "}
                          {r().sectionCount}
                        </Box>
                      </Show>
                      <Box>
                        <Box as="span" fontWeight="semibold" color="fg.default">
                          Created:
                        </Box>{" "}
                        {new Date(r().createdAt).toLocaleString()}
                      </Box>
                      <Show when={r().params}>
                        <Box pt="2">
                          <Box
                            as="span"
                            fontWeight="semibold"
                            color="fg.default"
                          >
                            Params:
                          </Box>
                          <Box
                            as="pre"
                            mt="2"
                            fontSize="xs"
                            bg="bg.muted"
                            borderWidth="1px"
                            borderColor="border"
                            borderRadius="l2"
                            p="2"
                            overflow="auto"
                            maxH="160px"
                          >
                            {JSON.stringify(r().params, null, 2)}
                          </Box>
                        </Box>
                      </Show>
                    </Stack>
                  )}
                </Show>
              </Suspense>
            </Stack>

            <Button
              size="sm"
              variant="solid"
              colorPalette="red"
              loading={busy()}
              onClick={handleDelete}
            >
              Delete Run
            </Button>
          </Flex>

          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="l2"
            p="3"
          >
            <Stack gap="3">
              <Heading as="h2" fontSize="sm">
                Create UMAP Projection
              </Heading>
              <HStack gap="3" flexWrap="wrap">
                <Text textStyle="sm" fontWeight="medium">
                  Dims
                </Text>
                <HStack gap="2">
                  <Button
                    size="sm"
                    variant={state.dims === 2 ? "solid" : "outline"}
                    colorPalette="green"
                    onClick={() => setState("dims", 2)}
                  >
                    2D
                  </Button>
                  <Button
                    size="sm"
                    variant={state.dims === 3 ? "solid" : "outline"}
                    colorPalette="green"
                    onClick={() => setState("dims", 3)}
                  >
                    3D
                  </Button>
                </HStack>
                <Button
                  size="sm"
                  variant="solid"
                  colorPalette="green"
                  loading={busy()}
                  onClick={handleStartUmap}
                >
                  Start UMAP
                </Button>
              </HStack>
            </Stack>
          </Box>

          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="l2"
            p="3"
          >
            <Stack gap="3">
              <Flex align="center" justify="space-between" gap="3" flexWrap="wrap">
                <Heading as="h2" fontSize="sm">
                  Process More Notes
                </Heading>
                <Show when={run()}>
                  {(r) => (
                    <Text textStyle="sm" color="fg.muted">
                      Remaining: {r().remaining ?? Math.max(0, r().count || 0)}
                    </Text>
                  )}
                </Show>
              </Flex>
              <HStack gap="3" flexWrap="wrap">
                <Text textStyle="sm" fontWeight="medium">
                  Batch size
                </Text>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={String(state.batchSize)}
                  onInput={(e) =>
                    setState(
                      "batchSize",
                      Math.max(1, Math.min(500, Number(e.currentTarget.value) || 0))
                    )
                  }
                />
                <Button
                  size="sm"
                  variant="solid"
                  colorPalette="green"
                  loading={busy()}
                  onClick={handleProcessMore}
                >
                  Process More
                </Button>
              </HStack>
            </Stack>
          </Box>

          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="l2"
            p="3"
          >
            <Stack gap="3">
              <Flex align="center" justify="space-between" gap="3" flexWrap="wrap">
                <Heading as="h2" fontSize="sm">
                  Re-embed Changed Notes
                </Heading>
                <Show when={run()}>
                  {(r) => (
                    <Text textStyle="sm" color="fg.muted">
                      Changed eligible: {r().changedEligible ?? 0}
                    </Text>
                  )}
                </Show>
              </Flex>
              <HStack gap="3" flexWrap="wrap">
                <Text textStyle="sm" fontWeight="medium">
                  Batch size
                </Text>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={String(state.batchSize)}
                  onInput={(e) =>
                    setState(
                      "batchSize",
                      Math.max(1, Math.min(500, Number(e.currentTarget.value) || 0))
                    )
                  }
                />
                <Button
                  size="sm"
                  variant="solid"
                  colorPalette="green"
                  loading={busy()}
                  onClick={handleProcessChanged}
                >
                  Process Changed
                </Button>
              </HStack>
            </Stack>
          </Box>

          <Suspense
            fallback={
              <Text textStyle="sm" color="fg.muted">
                Loading notes…
              </Text>
            }
          >
            <Show when={run()}>
              {(r) => (
                <Grid
                  gridTemplateColumns={{ base: "1fr", lg: "2fr 1fr" }}
                  gap="4"
                >
                  <Box
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="l2"
                    p="3"
                  >
                    <Stack gap="3">
                      <Flex
                        align="center"
                        justify="space-between"
                        gap="3"
                        flexWrap="wrap"
                      >
                        <Heading as="h2" fontSize="sm">
                          Included Notes
                        </Heading>
                        <Text textStyle="sm" color="fg.muted">
                          {includedRangeLabel()}
                        </Text>
                      </Flex>

                      <Box
                        borderWidth="1px"
                        borderColor="border"
                        borderRadius="l2"
                        overflow="hidden"
                      >
                        <Show
                          when={(r().docs?.items?.length || 0) > 0}
                          fallback={
                            <Box p="3">
                              <Text textStyle="sm" color="fg.muted">
                                No notes found.
                              </Text>
                            </Box>
                          }
                        >
                          <Stack gap="0">
                            <For each={r().docs?.items ?? []}>
                              {(d) => (
                                <Flex
                                  align="center"
                                  justify="space-between"
                                  gap="3"
                                  p="3"
                                  borderTopWidth="1px"
                                  borderColor="border"
                                  _first={{ borderTopWidth: "0px" }}
                                >
                                  <Box minW="0">
                                    <Link
                                      href={`/docs/${d.id}`}
                                      display="block"
                                      whiteSpace="nowrap"
                                      overflow="hidden"
                                      textOverflow="ellipsis"
                                    >
                                      {d.title}
                                    </Link>
                                    <Text textStyle="xs" color="fg.muted">
                                      {new Date(d.embeddedAt).toLocaleString()}
                                    </Text>
                                  </Box>
                                  <HStack gap="2">
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      onClick={() => handleLoadSections(d.id)}
                                    >
                                      Sections
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      onClick={() => handleOpenDoc(d.id)}
                                    >
                                      Open
                                    </Button>
                                  </HStack>
                                </Flex>
                              )}
                            </For>
                          </Stack>
                        </Show>
                      </Box>

                      <Flex align="center" justify="space-between" gap="3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!hasPrev()}
                          onClick={handlePrev}
                        >
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!hasNext()}
                          onClick={handleNext}
                        >
                          Next
                        </Button>
                      </Flex>
                    </Stack>
                  </Box>

                  <Show when={state.selectedDocId}>
                    <Box
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="l2"
                      p="3"
                    >
                      <Stack gap="3">
                        <Heading as="h2" fontSize="sm">
                          Sections for note
                        </Heading>
                        <Stack gap="2">
                          <For each={state.sections}>
                            {(s) => (
                              <Box
                                borderWidth="1px"
                                borderColor="border"
                                borderRadius="l2"
                                p="2"
                              >
                                <HStack gap="2" flexWrap="wrap">
                                  <Text textStyle="xs" color="fg.muted">
                                    {(s.headingPath || []).join(" → ") ||
                                      "(no heading)"}
                                  </Text>
                                  <Text textStyle="xs" color="fg.muted">
                                    #{s.orderIndex}
                                  </Text>
                                  <Show when={s.embedded}>
                                    <Badge
                                      size="sm"
                                      variant="solid"
                                      colorPalette="green"
                                    >
                                      embedded
                                    </Badge>
                                  </Show>
                                </HStack>
                                <Text
                                  textStyle="sm"
                                  whiteSpace="nowrap"
                                  overflow="hidden"
                                  textOverflow="ellipsis"
                                  mt="1"
                                >
                                  {s.preview}
                                </Text>
                              </Box>
                            )}
                          </For>
                        </Stack>
                      </Stack>
                    </Box>
                  </Show>
                </Grid>
              )}
            </Show>
          </Suspense>

          <Link href="/embeddings">← Back to Embeddings</Link>
        </Stack>
      </Container>
    </Box>
  );
};

export default EmbeddingDetail;
