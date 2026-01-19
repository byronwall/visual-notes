import {
  type VoidComponent,
  For,
  Show,
  Suspense,
  createResource,
} from "solid-js";
import { createStore } from "solid-js/store";
import { apiFetch } from "~/utils/base-url";
import { Button } from "~/components/ui/button";
import * as Checkbox from "~/components/ui/checkbox";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import type { SimpleSelectItem } from "~/components/ui/simple-select";
import { SimpleSelect } from "~/components/ui/simple-select";
import * as Table from "~/components/ui/table";
import { Box, Container, Flex, Grid, HStack, Stack } from "styled-system/jsx";

type EmbeddingRun = {
  id: string;
  model: string;
  dims: number;
  params: Record<string, unknown> | null;
  createdAt: string;
  count: number;
};

async function listEmbeddingRuns(): Promise<EmbeddingRun[]> {
  const res = await apiFetch("/api/embeddings/runs");
  if (!res.ok) throw new Error("Failed to load embedding runs");
  const json = (await res.json()) as { runs: EmbeddingRun[] };
  return json.runs || [];
}

async function triggerEmbeddingRun(
  model?: string,
  params?: Record<string, unknown>
) {
  const res = await apiFetch("/api/embeddings/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, params }),
  });
  if (!res.ok)
    throw new Error((await res.json()).error || "Failed to create run");
  return (await res.json()) as { runId: string; count: number };
}

type CodeblockPolicy = "stub" | "keep-first-20-lines" | "full";
type ChunkerMode = "structure" | "sliding";

type SelectItem = SimpleSelectItem;

const CODEBLOCK_ITEMS: SelectItem[] = [
  { label: "stub", value: "stub" },
  { label: "keep-first-20-lines", value: "keep-first-20-lines" },
  { label: "full", value: "full" },
];

const CHUNKER_MODE_ITEMS: SelectItem[] = [
  { label: "structure", value: "structure" },
  { label: "sliding", value: "sliding" },
];

function parseCodeblockPolicy(v: string): CodeblockPolicy {
  if (v === "full") return "full";
  if (v === "keep-first-20-lines") return "keep-first-20-lines";
  return "stub";
}

function parseChunkerMode(v: string): ChunkerMode {
  return v === "sliding" ? "sliding" : "structure";
}

const EmbeddingsIndex: VoidComponent = () => {
  const [runs, { refetch }] = createResource(listEmbeddingRuns);
  const [state, setState] = createStore({
    creating: false,
    model: "",
    showAdvanced: false,
    // Preprocess flags
    stripDataUris: true,
    mdToPlain: true,
    stripBareUrls: true,
    normalizeWs: true,
    keepOutline: true,
    codeblockPolicy: "stub" as CodeblockPolicy,
    // Chunker config
    chunkerMode: "structure" as ChunkerMode,
    minTokens: 100,
    maxTokens: 400,
    winSize: 384,
    winOverlap: 48,
  });

  const handleToggleAdvanced = () => {
    setState("showAdvanced", !state.showAdvanced);
  };

  const handleCreateRun = async () => {
    try {
      setState("creating", true);
      const params = {
        PREPROCESS_STRIP_DATA_URIS: state.stripDataUris,
        PREPROCESS_MARKDOWN_TO_PLAIN: state.mdToPlain,
        PREPROCESS_STRIP_BARE_URLS: state.stripBareUrls,
        PREPROCESS_CODEBLOCK_POLICY: state.codeblockPolicy,
        PREPROCESS_NORMALIZE_WHITESPACE: state.normalizeWs,
        PREPROCESS_KEEP_OUTLINE: state.keepOutline,
        CHUNKER_MODE: state.chunkerMode,
        CHUNK_MIN_MAX_TOKENS:
          state.chunkerMode === "sliding"
            ? { size: state.winSize, overlap: state.winOverlap }
            : { min: state.minTokens, max: state.maxTokens },
      } as Record<string, unknown>;

      console.log("[EmbeddingsIndex] createRun", {
        model: state.model || undefined,
        params,
      });

      await triggerEmbeddingRun(state.model || undefined, params);
      await refetch();
      setState("model", "");
    } catch (e) {
      console.error(e);
      alert("Failed to start embedding run");
    } finally {
      setState("creating", false);
    }
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="4" px="4" maxW="1200px">
        <Stack gap="6">
          <Flex align="center" justify="space-between" gap="4" flexWrap="wrap">
            <Heading as="h1" fontSize="2xl">
              Embeddings
            </Heading>

            <HStack gap="3" flexWrap="wrap">
              <Input
                value={state.model}
                onInput={(e) => setState("model", e.currentTarget.value)}
                placeholder="Model (optional)"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleAdvanced}
              >
                <Show when={state.showAdvanced} fallback={"Advanced"}>
                  Hide Advanced
                </Show>
              </Button>
              <Button
                size="sm"
                variant="solid"
                colorPalette="green"
                loading={state.creating}
                onClick={handleCreateRun}
              >
                Create Run
              </Button>
            </HStack>
          </Flex>

          <Show when={state.showAdvanced}>
            <Box borderWidth="1px" borderColor="border" borderRadius="l2" p="3">
              <Grid
                gridTemplateColumns={{
                  base: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                }}
                gap="4"
              >
                <Stack gap="3">
                  <Heading as="h2" fontSize="sm">
                    Preprocessing
                  </Heading>

                  <HStack gap="2">
                    <Checkbox.Root
                      checked={state.stripDataUris}
                      onCheckedChange={(details) =>
                        setState("stripDataUris", details.checked === true)
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Root>
                    <Text textStyle="sm">Strip data URIs</Text>
                  </HStack>

                  <HStack gap="2">
                    <Checkbox.Root
                      checked={state.mdToPlain}
                      onCheckedChange={(details) =>
                        setState("mdToPlain", details.checked === true)
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Root>
                    <Text textStyle="sm">Markdown → plain</Text>
                  </HStack>

                  <HStack gap="2">
                    <Checkbox.Root
                      checked={state.stripBareUrls}
                      onCheckedChange={(details) =>
                        setState("stripBareUrls", details.checked === true)
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Root>
                    <Text textStyle="sm">Strip bare URLs</Text>
                  </HStack>

                  <HStack gap="2">
                    <Checkbox.Root
                      checked={state.normalizeWs}
                      onCheckedChange={(details) =>
                        setState("normalizeWs", details.checked === true)
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Root>
                    <Text textStyle="sm">Normalize whitespace</Text>
                  </HStack>

                  <HStack gap="2">
                    <Checkbox.Root
                      checked={state.keepOutline}
                      onCheckedChange={(details) =>
                        setState("keepOutline", details.checked === true)
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Root>
                    <Text textStyle="sm">Keep outline (H1→H3)</Text>
                  </HStack>

                  <SimpleSelect
                    items={CODEBLOCK_ITEMS}
                    value={state.codeblockPolicy}
                    onChange={(value) =>
                      setState("codeblockPolicy", parseCodeblockPolicy(value))
                    }
                    label="Code blocks"
                    sameWidth
                    placeholder="Pick policy"
                  />
                </Stack>

                <Stack gap="3">
                  <Heading as="h2" fontSize="sm">
                    Chunking
                  </Heading>

                  <SimpleSelect
                    items={CHUNKER_MODE_ITEMS}
                    value={state.chunkerMode}
                    onChange={(value) =>
                      setState("chunkerMode", parseChunkerMode(value))
                    }
                    label="Mode"
                    sameWidth
                    placeholder="Pick mode"
                  />

                  <Show when={state.chunkerMode === "structure"}>
                    <Grid
                      gridTemplateColumns="repeat(2, minmax(0, 1fr))"
                      gap="3"
                    >
                      <Stack gap="1">
                        <Text textStyle="sm" fontWeight="medium">
                          Min tokens
                        </Text>
                        <Input
                          type="number"
                          value={String(state.minTokens)}
                          onInput={(e) =>
                            setState(
                              "minTokens",
                              Math.max(1, Number(e.currentTarget.value) || 0)
                            )
                          }
                        />
                      </Stack>
                      <Stack gap="1">
                        <Text textStyle="sm" fontWeight="medium">
                          Max tokens
                        </Text>
                        <Input
                          type="number"
                          value={String(state.maxTokens)}
                          onInput={(e) =>
                            setState(
                              "maxTokens",
                              Math.max(
                                state.minTokens,
                                Number(e.currentTarget.value) || 0
                              )
                            )
                          }
                        />
                      </Stack>
                    </Grid>
                  </Show>

                  <Show when={state.chunkerMode === "sliding"}>
                    <Grid
                      gridTemplateColumns="repeat(2, minmax(0, 1fr))"
                      gap="3"
                    >
                      <Stack gap="1">
                        <Text textStyle="sm" fontWeight="medium">
                          Window size
                        </Text>
                        <Input
                          type="number"
                          value={String(state.winSize)}
                          onInput={(e) =>
                            setState(
                              "winSize",
                              Math.max(32, Number(e.currentTarget.value) || 0)
                            )
                          }
                        />
                      </Stack>
                      <Stack gap="1">
                        <Text textStyle="sm" fontWeight="medium">
                          Overlap
                        </Text>
                        <Input
                          type="number"
                          value={String(state.winOverlap)}
                          onInput={(e) =>
                            setState(
                              "winOverlap",
                              Math.max(0, Number(e.currentTarget.value) || 0)
                            )
                          }
                        />
                      </Stack>
                    </Grid>
                  </Show>
                </Stack>
              </Grid>
            </Box>
          </Show>

          <Suspense
            fallback={
              <Text textStyle="sm" color="fg.muted">
                Loading…
              </Text>
            }
          >
            <Show when={runs()}>
              {(items) => (
                <Box
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="l2"
                  overflow="hidden"
                >
                  <Table.Root>
                    <Table.Head>
                      <Table.Row>
                        <Table.Header textAlign="left">Run</Table.Header>
                        <Table.Header textAlign="left">Model</Table.Header>
                        <Table.Header textAlign="left">Dims</Table.Header>
                        <Table.Header textAlign="left">Notes</Table.Header>
                        <Table.Header textAlign="left">Created</Table.Header>
                        <Table.Header textAlign="right">Actions</Table.Header>
                      </Table.Row>
                    </Table.Head>
                    <Table.Body>
                      <For each={items()}>
                        {(r) => (
                          <Table.Row>
                            <Table.Cell>
                              <Link href={`/embeddings/${r.id}`}>
                                {r.id.slice(0, 8)}
                              </Link>
                            </Table.Cell>
                            <Table.Cell>{r.model}</Table.Cell>
                            <Table.Cell>{r.dims}</Table.Cell>
                            <Table.Cell>{r.count}</Table.Cell>
                            <Table.Cell>
                              {new Date(r.createdAt).toLocaleString()}
                            </Table.Cell>
                            <Table.Cell textAlign="right">
                              <Link href={`/embeddings/${r.id}`}>View</Link>
                            </Table.Cell>
                          </Table.Row>
                        )}
                      </For>
                    </Table.Body>
                  </Table.Root>
                </Box>
              )}
            </Show>
          </Suspense>
        </Stack>
      </Container>
    </Box>
  );
};

export default EmbeddingsIndex;
