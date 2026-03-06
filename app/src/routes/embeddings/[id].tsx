import {
  type VoidComponent,
  createEffect,
  For,
  onCleanup,
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
import { Tooltip } from "~/components/ui/tooltip";
import { Box, Container, Flex, Grid, HStack, Stack } from "styled-system/jsx";
import { fetchDocSections, fetchEmbeddingRun } from "~/services/embeddings/embeddings.queries";
import { deleteEmbeddingRun, processEmbeddingRun } from "~/services/embeddings/embeddings.actions";
import { createUmapRun } from "~/services/umap/umap.actions";
import { fetchUmapRuns } from "~/services/umap/umap.queries";
import { fetchJobStatus, type JobStatus } from "~/services/jobs/jobs.queries";

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
    total: number;
  };
};

const DOCS_LIMIT = 10;


type SectionItem = {
  id: string;
  headingPath: string[];
  orderIndex: number;
  charCount: number;
  preview: string;
  embedded?: boolean;
};

type UmapRunSummary = {
  id: string;
  dims: number;
  hasArtifact: boolean;
  createdAt: string;
};

type ProcessEmbeddingResult = {
  umapProjection?: {
    runsUpdated: number;
    pointsProjected: number;
    failedRuns: number;
  };
};

function formatParamValue(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getParamEntries(params?: Record<string, unknown> | null): [string, unknown][] {
  return Object.entries(params ?? {}).sort(([a], [b]) => a.localeCompare(b));
}

const EmbeddingDetail: VoidComponent = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [docsOffset, setDocsOffset] = createSignal(0);
  const [titleQuery, setTitleQuery] = createSignal("");
  const run = createAsync(() => {
    if (!params.id) return Promise.resolve<EmbeddingRun | null>(null);
    return fetchEmbeddingRun({
      id: params.id,
      includeDocs: true,
      limit: DOCS_LIMIT,
      offset: docsOffset(),
      titleQuery: titleQuery(),
    }) as Promise<EmbeddingRun | null>;
  });
  const [state, setState] = createStore({
    dims: 2 as 2 | 3,
    batchSize: 200,
    selectedDocId: null as string | null,
    sections: [] as SectionItem[],
    sectionsLoading: false,
    activeJobId: "",
    lastProjectionSummary: null as null | {
      runsUpdated: number;
      pointsProjected: number;
      failedRuns: number;
    },
  });
  const umapRunsForEmbedding = createAsync((): Promise<UmapRunSummary[]> => {
    if (!params.id) return Promise.resolve([]);
    return fetchUmapRuns({ embeddingRunId: params.id, limit: 200 }) as Promise<UmapRunSummary[]>;
  });
  const activeJob = createAsync((): Promise<JobStatus | null> => {
    if (!state.activeJobId) return Promise.resolve(null);
    return fetchJobStatus(state.activeJobId);
  });

  createEffect(() => {
    const jobId = state.activeJobId;
    if (!jobId || typeof window === "undefined") return;
    const timer = window.setInterval(() => {
      void revalidate(fetchJobStatus.keyFor(jobId));
    }, 1200);
    onCleanup(() => window.clearInterval(timer));
  });

  createEffect(() => {
    if (!params.id) return;
    console.info("[EmbeddingDetail] requestRun", {
      id: params.id,
      limit: DOCS_LIMIT,
      offset: docsOffset(),
      titleQuery: titleQuery(),
    });
  });

  createEffect(() => {
    const r = run();
    if (!r) return;
    console.info("[EmbeddingDetail] runLoaded", {
      id: r.id,
      docsReturned: r.docs?.items?.length ?? 0,
      docsTotal: r.docs?.total ?? 0,
      offset: r.docs?.offset ?? 0,
      limit: r.docs?.limit ?? DOCS_LIMIT,
    });
  });
  const runDeleteEmbedding = useAction(deleteEmbeddingRun);
  const runCreateUmap = useAction(createUmapRun);
  const runProcessEmbedding = useAction(processEmbeddingRun);
  const [busy, setBusy] = createSignal(false);

  const includedRangeLabel = () => {
    const r = run();
    if (!r?.docs) return "";
    if ((r.docs.total || 0) === 0) return "Showing 0 of 0";
    const start = (r.docs.offset || 0) + 1;
    const end = (r.docs.offset || 0) + (r.docs.items?.length || 0);
    return `Showing ${start}-${end} of ${r.docs.total}`;
  };

  const hasPrev = () => (run()?.docs?.offset || 0) > 0;
  const hasNext = () => {
    const off = run()?.docs?.offset || 0;
    const len = run()?.docs?.items?.length || 0;
    return off + len < (run()?.docs?.total || 0);
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
    const jobId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `umap-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setState("activeJobId", jobId);
    await revalidate(fetchJobStatus.keyFor(jobId));
    try {
      setBusy(true);
      console.log("[EmbeddingDetail] startUmap", {
        embeddingRunId: params.id,
        dims: state.dims,
      });
      const r = await runCreateUmap({
        embeddingRunId: params.id,
        jobId,
        dims: state.dims,
      });
      await revalidate(fetchUmapRuns.keyFor({ embeddingRunId: params.id, limit: 200 }));
      navigate(`/umap/${r.runId}`);
    } catch (e) {
      console.error(e);
      alert("Failed to start UMAP run");
    } finally {
      setBusy(false);
      setState("activeJobId", "");
    }
  };

  const handleProcessMore = async () => {
    try {
      setBusy(true);
      console.log("[EmbeddingDetail] processMore", {
        id: params.id,
        limit: state.batchSize,
      });
      const result = (await runProcessEmbedding({
        id: params.id,
        limit: state.batchSize,
      })) as ProcessEmbeddingResult;
      setState("lastProjectionSummary", result.umapProjection ?? null);
      await revalidate(
        fetchEmbeddingRun.keyFor({
          id: params.id,
          includeDocs: true,
          limit: DOCS_LIMIT,
          offset: docsOffset(),
          titleQuery: titleQuery(),
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
      const result = (await runProcessEmbedding({
        id: params.id,
        limit: state.batchSize,
        mode: "changed",
      })) as ProcessEmbeddingResult;
      setState("lastProjectionSummary", result.umapProjection ?? null);
      await revalidate(
        fetchEmbeddingRun.keyFor({
          id: params.id,
          includeDocs: true,
          limit: DOCS_LIMIT,
          offset: docsOffset(),
          titleQuery: titleQuery(),
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

  const handleTitleQueryInput = (value: string) => {
    setTitleQuery(value);
    setDocsOffset(0);
    console.info("[EmbeddingDetail] setTitleQuery", {
      id: params.id,
      titleQuery: value,
    });
  };

  const handleLoadSections = async (docId: string) => {
    if (state.selectedDocId === docId) {
      setState("selectedDocId", null);
      setState("sections", []);
      setState("sectionsLoading", false);
      console.info("[EmbeddingDetail] collapseSections", { docId, runId: params.id });
      return;
    }

    setState("selectedDocId", docId);
    setState("sections", []);
    setState("sectionsLoading", true);
    try {
      console.log("[EmbeddingDetail] loadSections", { docId, runId: params.id });
      const items = await fetchDocSections({ docId, runId: params.id });
      setState("sections", items || []);
      console.info("[EmbeddingDetail] sectionsLoaded", {
        docId,
        runId: params.id,
        count: items?.length || 0,
      });
    } catch (e) {
      console.error(e);
      alert("Failed to load sections");
    } finally {
      setState("sectionsLoading", false);
    }
  };

  const handleOpenDoc = (docId: string) => {
    navigate(`/docs/${docId}`);
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="4" px="4" maxW="1440px">
        <Suspense
          fallback={
            <Box bg="bg.subtle" borderRadius="l3" p="4">
              <Text textStyle="sm" color="fg.muted">
                Loading embedding run…
              </Text>
            </Box>
          }
        >
          <Show
          when={run()}
          fallback={
              <Box bg="bg.subtle" borderRadius="l3" p="4">
                <Text textStyle="sm" color="fg.muted">
                  This embedding run could not be loaded.
                </Text>
                <Box mt="3">
                  <Link href="/embeddings">Back to Embeddings</Link>
                </Box>
              </Box>
            }
          >
            {(r) => {
              const paramEntries = getParamEntries(r().params);
              return (
                <Grid
                  gridTemplateColumns={{
                    base: "1fr",
                    xl: "minmax(0, 1.8fr) minmax(340px, 1fr)",
                  }}
                  gap="4"
                  alignItems="start"
                >
                  <Stack gap="3">
                    <Box bg="bg.subtle" borderRadius="l3" p="4">
                      <Flex align="center" justify="space-between" gap="3" flexWrap="wrap">
                        <Stack gap="1">
                          <Heading as="h1" fontSize="2xl">
                            Embedding Run
                          </Heading>
                          <Text textStyle="sm" color="fg.muted">
                            Process new or changed notes, then train or reuse UMAP models.
                          </Text>
                        </Stack>
                        <HStack gap="2" flexWrap="wrap">
                          <Link href="/embeddings">Back to Embeddings</Link>
                          <Tooltip content="Delete this embedding run and its vectors" showArrow>
                            <Button
                              size="sm"
                              variant="solid"
                              colorPalette="red"
                              loading={busy()}
                              onClick={handleDelete}
                            >
                              Delete Run
                            </Button>
                          </Tooltip>
                        </HStack>
                      </Flex>
                    </Box>

                    <Box bg="bg.subtle" borderRadius="l3" p="3">
                      <Stack gap="3">
                        <Heading as="h2" fontSize="sm">
                          Run Operations
                        </Heading>

                        <HStack gap="3" flexWrap="wrap" alignItems="center">
                          <Text textStyle="sm" fontWeight="medium">
                            Batch size
                          </Text>
                          <Input
                            type="number"
                            min="1"
                            max="500"
                            maxW="120px"
                            value={String(state.batchSize)}
                            onInput={(e) =>
                              setState(
                                "batchSize",
                                Math.max(1, Math.min(500, Number(e.currentTarget.value) || 0))
                              )
                            }
                          />
                          <Text textStyle="xs" color="fg.muted">
                            Applies to Process More and Process Changed.
                          </Text>
                        </HStack>

                        <Grid
                          gridTemplateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }}
                          gap="3"
                        >
                          <Box bg="bg.default" borderRadius="l2" p="3">
                            <Stack gap="2">
                              <Text textStyle="sm" fontWeight="medium">
                                Embed New Notes
                              </Text>
                              <Text textStyle="xs" color="fg.muted">
                                Remaining: {r().remaining ?? Math.max(0, r().count || 0)}
                              </Text>
                              <Tooltip
                                content="Embed the next batch of notes missing vectors for this run"
                                showArrow
                              >
                                <Button
                                  size="sm"
                                  variant="solid"
                                  colorPalette="green"
                                  loading={busy()}
                                  onClick={handleProcessMore}
                                >
                                  Process More
                                </Button>
                              </Tooltip>
                            </Stack>
                          </Box>

                          <Box bg="bg.default" borderRadius="l2" p="3">
                            <Stack gap="2">
                              <Text textStyle="sm" fontWeight="medium">
                                Re-embed Updated Notes
                              </Text>
                              <Text textStyle="xs" color="fg.muted">
                                Changed eligible: {r().changedEligible ?? 0}
                              </Text>
                              <Tooltip
                                content="Recompute vectors for notes updated since their last embedding"
                                showArrow
                              >
                                <Button
                                  size="sm"
                                  variant="solid"
                                  colorPalette="green"
                                  loading={busy()}
                                  onClick={handleProcessChanged}
                                >
                                  Process Changed
                                </Button>
                              </Tooltip>
                            </Stack>
                          </Box>
                        </Grid>

                        <Flex align="center" justify="space-between" gap="3" flexWrap="wrap">
                          <HStack gap="2">
                            <Text textStyle="sm" fontWeight="medium">
                              UMAP dims
                            </Text>
                            <Tooltip content="Train or project into a 2D UMAP layout" showArrow>
                              <Button
                                size="sm"
                                variant={state.dims === 2 ? "solid" : "outline"}
                                colorPalette="green"
                                onClick={() => setState("dims", 2)}
                              >
                                2D
                              </Button>
                            </Tooltip>
                            <Tooltip content="Train or project into a 3D UMAP layout" showArrow>
                              <Button
                                size="sm"
                                variant={state.dims === 3 ? "solid" : "outline"}
                                colorPalette="green"
                                onClick={() => setState("dims", 3)}
                              >
                                3D
                              </Button>
                            </Tooltip>
                          </HStack>
                          <Tooltip content="Train a new UMAP model from this embedding run" showArrow>
                            <Button
                              size="sm"
                              variant="solid"
                              colorPalette="green"
                              loading={busy()}
                              onClick={handleStartUmap}
                            >
                              Start UMAP
                            </Button>
                          </Tooltip>
                        </Flex>

                        <Show when={state.activeJobId}>
                          <Suspense fallback={null}>
                            <Show when={activeJob()}>
                              {(job) => (
                                <Box bg="bg.default" borderRadius="l2" p="3">
                                  <Stack gap="2">
                                    <Flex align="center" justify="space-between" gap="3">
                                      <Text textStyle="sm" fontWeight="medium">
                                        {job().typeLabel}
                                      </Text>
                                      <Text textStyle="xs" color="fg.muted">
                                        {job().stageLabel} • {job().progress}%
                                      </Text>
                                    </Flex>
                                    <Box
                                      h="2"
                                      w="full"
                                      bg="bg.muted"
                                      borderRadius="full"
                                      overflow="hidden"
                                    >
                                      <Box
                                        h="full"
                                        bg={job().stage === "failed" ? "red.500" : "green.500"}
                                        style={{
                                          width: `${Math.max(0, Math.min(100, job().progress))}%`,
                                          transition: "width 180ms ease",
                                        }}
                                      />
                                    </Box>
                                  </Stack>
                                </Box>
                              )}
                            </Show>
                          </Suspense>
                        </Show>

                        <Show when={state.lastProjectionSummary}>
                          {(summary) => (
                            <Text textStyle="xs" color="fg.muted">
                              Auto-projected: {summary().pointsProjected} points across{" "}
                              {summary().runsUpdated} UMAP runs
                              {summary().failedRuns > 0 ? ` (${summary().failedRuns} failed)` : ""}.
                            </Text>
                          )}
                        </Show>
                      </Stack>
                    </Box>

                    <Box bg="bg.subtle" borderRadius="l3" p="3">
                      <Stack gap="3">
                        <Flex align="center" justify="space-between" gap="3" flexWrap="wrap">
                          <Heading as="h2" fontSize="sm">
                            Included Notes
                          </Heading>
                          <Text textStyle="sm" color="fg.muted">
                            {includedRangeLabel()}
                          </Text>
                        </Flex>

                        <HStack gap="3" flexWrap="wrap">
                          <Input
                            type="text"
                            placeholder="Search note title…"
                            value={titleQuery()}
                            maxW="360px"
                            onInput={(e) => handleTitleQueryInput(e.currentTarget.value)}
                          />
                          <Show when={titleQuery().trim().length > 0}>
                            <Text textStyle="xs" color="fg.muted">
                              Filter: {titleQuery().trim()}
                            </Text>
                          </Show>
                        </HStack>

                        <Box
                          bg="bg.muted"
                          borderRadius="l2"
                          p="2"
                        >
                          <Show
                            when={(r().docs?.items?.length || 0) > 0}
                            fallback={
                              <Box p="3">
                                <Text textStyle="sm" color="fg.muted">
                                  No notes found for this query.
                                </Text>
                              </Box>
                            }
                          >
                            <Stack gap="2">
                              <For each={r().docs?.items ?? []}>
                                {(d) => (
                                  <Stack gap="2" bg="bg.default" borderRadius="l2" p="3">
                                    <Flex align="center" justify="space-between" gap="3">
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
                                        <Tooltip content="Expand embedded sections for this note" showArrow>
                                          <Button
                                            size="xs"
                                            variant="outline"
                                            onClick={() => handleLoadSections(d.id)}
                                          >
                                            {state.selectedDocId === d.id ? "Hide Sections" : "Sections"}
                                          </Button>
                                        </Tooltip>
                                        <Tooltip content="Open this note document" showArrow>
                                          <Button
                                            size="xs"
                                            variant="outline"
                                            onClick={() => handleOpenDoc(d.id)}
                                          >
                                            Open
                                          </Button>
                                        </Tooltip>
                                      </HStack>
                                    </Flex>

                                    <Show when={state.selectedDocId === d.id}>
                                      <Box bg="bg.subtle" borderRadius="l2" p="2">
                                        <Show
                                          when={state.sectionsLoading}
                                          fallback={
                                            <Show
                                              when={state.sections.length > 0}
                                              fallback={
                                                <Text textStyle="xs" color="fg.muted">
                                                  No embedded sections found for this note.
                                                </Text>
                                              }
                                            >
                                              <Stack gap="2">
                                                <For each={state.sections}>
                                                  {(s) => (
                                                    <Box bg="bg.default" borderRadius="l1" p="2">
                                                      <HStack gap="2" flexWrap="wrap">
                                                        <Text textStyle="xs" color="fg.muted">
                                                          {(s.headingPath || []).join(" → ") || "(no heading)"}
                                                        </Text>
                                                        <Text textStyle="xs" color="fg.muted">
                                                          #{s.orderIndex}
                                                        </Text>
                                                        <Show when={s.embedded}>
                                                          <Badge size="sm" variant="solid" colorPalette="green">
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
                                            </Show>
                                          }
                                        >
                                          <Text textStyle="xs" color="fg.muted">
                                            Loading sections…
                                          </Text>
                                        </Show>
                                      </Box>
                                    </Show>
                                  </Stack>
                                )}
                              </For>
                            </Stack>
                          </Show>
                        </Box>

                        <Flex align="center" justify="space-between" gap="3">
                          <Tooltip content="Go to previous page of included notes" showArrow>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!hasPrev()}
                              onClick={handlePrev}
                            >
                              Previous
                            </Button>
                          </Tooltip>
                          <Tooltip content="Go to next page of included notes" showArrow>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!hasNext()}
                              onClick={handleNext}
                            >
                              Next
                            </Button>
                          </Tooltip>
                        </Flex>
                      </Stack>
                    </Box>
                  </Stack>

                  <Stack gap="3">
                    <Box bg="bg.subtle" borderRadius="l3" p="3">
                      <Stack gap="2">
                        <Heading as="h2" fontSize="sm">
                          Run Metadata
                        </Heading>
                        <Grid
                          gridTemplateColumns="auto 1fr"
                          columnGap="3"
                          rowGap="2"
                          alignItems="start"
                        >
                          <Text textStyle="xs" color="fg.subtle">
                            ID
                          </Text>
                          <Text textStyle="xs" fontFamily="mono" lineBreak="anywhere">
                            {r().id}
                          </Text>
                          <Text textStyle="xs" color="fg.subtle">
                            Model
                          </Text>
                          <Text textStyle="sm">{r().model}</Text>
                          <Text textStyle="xs" color="fg.subtle">
                            Dimensions
                          </Text>
                          <Text textStyle="sm">{r().dims}</Text>
                          <Text textStyle="xs" color="fg.subtle">
                            Embeddings
                          </Text>
                          <Text textStyle="sm">{r().count.toLocaleString()}</Text>
                          <Show when={r().sectionCount !== undefined}>
                            <Text textStyle="xs" color="fg.subtle">
                              Sections
                            </Text>
                            <Text textStyle="sm">
                              {(r().sectionCount ?? 0).toLocaleString()}
                            </Text>
                          </Show>
                          <Text textStyle="xs" color="fg.subtle">
                            Created
                          </Text>
                          <Text textStyle="sm" color="fg.muted">
                            {new Date(r().createdAt).toLocaleString()}
                          </Text>
                        </Grid>
                      </Stack>
                    </Box>

                    <Box bg="bg.subtle" borderRadius="l3" p="3">
                      <Stack gap="2">
                        <Flex align="center" justify="space-between" gap="3">
                          <Heading as="h2" fontSize="sm">
                            Run Params
                          </Heading>
                          <Badge colorPalette="gray">{paramEntries.length}</Badge>
                        </Flex>
                        <Show
                          when={paramEntries.length > 0}
                          fallback={
                            <Text textStyle="sm" color="fg.muted">
                              No params recorded for this run.
                            </Text>
                          }
                        >
                          <Box maxH={{ base: "none", xl: "260px" }} overflowY="auto">
                            <Stack gap="1">
                              <For each={paramEntries}>
                                {([key, value]) => (
                                  <Grid
                                    gridTemplateColumns="minmax(0, 1fr) minmax(0, 1.2fr)"
                                    gap="3"
                                    py="2"
                                    px="2"
                                    bg="bg.default"
                                    borderRadius="l1"
                                    alignItems="start"
                                  >
                                    <Text
                                      textStyle="xs"
                                      fontFamily="mono"
                                      color="fg.subtle"
                                      lineBreak="anywhere"
                                    >
                                      {key}
                                    </Text>
                                    <Text textStyle="xs" lineBreak="anywhere">
                                      {formatParamValue(value)}
                                    </Text>
                                  </Grid>
                                )}
                              </For>
                            </Stack>
                          </Box>
                        </Show>
                      </Stack>
                    </Box>

                    <Box bg="bg.subtle" borderRadius="l3" p="3">
                      <Stack gap="3">
                        <Flex align="center" justify="space-between" gap="3" flexWrap="wrap">
                          <Heading as="h2" fontSize="sm">
                            Trained UMAP Models
                          </Heading>
                          <Link href="/umap">Open UMAP Workspace</Link>
                        </Flex>
                        <Suspense
                          fallback={
                            <Text textStyle="sm" color="fg.muted">
                              Loading UMAP models…
                            </Text>
                          }
                        >
                          <Show
                            when={(umapRunsForEmbedding()?.length || 0) > 0}
                            fallback={
                              <Text textStyle="sm" color="fg.muted">
                                No trained UMAP model yet for this embedding run.
                              </Text>
                            }
                          >
                            <Stack gap="2">
                              <For each={umapRunsForEmbedding() || []}>
                                {(ur) => (
                                  <HStack
                                    justify="space-between"
                                    gap="3"
                                    bg="bg.default"
                                    borderRadius="l2"
                                    p="2"
                                  >
                                    <HStack gap="2">
                                      <Text textStyle="sm">{ur.id.slice(0, 8)}</Text>
                                      <Text textStyle="xs" color="fg.muted">
                                        {ur.dims}D • {ur.hasArtifact ? "trained" : "missing model"}
                                      </Text>
                                    </HStack>
                                    <Link href={`/umap/${ur.id}`}>View</Link>
                                  </HStack>
                                )}
                              </For>
                            </Stack>
                          </Show>
                        </Suspense>
                      </Stack>
                    </Box>

                  </Stack>
                </Grid>
              );
            }}
          </Show>
        </Suspense>
      </Container>
    </Box>
  );
};

export default EmbeddingDetail;
