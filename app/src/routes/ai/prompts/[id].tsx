import {
  type VoidComponent,
  ErrorBoundary,
  For,
  Show,
  Suspense,
  createEffect,
  createResource,
  createSignal,
  onMount,
} from "solid-js";
import { useParams, A } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";
import { ModelSelect } from "~/components/ModelSelect";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import * as Card from "~/components/ui/card";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import * as Table from "~/components/ui/table";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { Box, Container, Flex, Grid, HStack, Stack } from "styled-system/jsx";
import { styled } from "styled-system/jsx";
import { link } from "styled-system/recipes";

type PromptVersion = {
  id: string;
  template: string;
  system?: string | null;
  modelOverride?: string | null;
  tempOverride?: number | null;
  topPOverride?: number | null;
  createdAt: string;
};

type PromptFull = {
  id: string;
  task: string;
  description?: string | null;
  defaultModel: string;
  defaultTemp: number;
  defaultTopP?: number | null;
  activeVersion?: PromptVersion | null;
  versions: PromptVersion[];
};

async function fetchPrompt(id: string): Promise<PromptFull> {
  const res = await apiFetch(`/api/prompts/${id}`);
  const data = (await res.json()) as { item: PromptFull };
  console.log("[ai-prompt] loaded", id);
  return data.item;
}

async function fetchRunsForPrompt(promptId: string) {
  const res = await apiFetch(
    `/api/ai/runs?promptId=${encodeURIComponent(promptId)}`
  );
  const json = (await res.json()) as {
    items: Array<{
      id: string;
      model: string;
      status: "SUCCESS" | "ERROR" | "PARTIAL";
      createdAt: string;
      versionId?: string | null;
    }>;
  };
  return json.items || [];
}

const formatOverrides = (version: {
  modelOverride?: string | null;
  tempOverride?: number | null;
  topPOverride?: number | null;
}) => {
  if (
    !version.modelOverride &&
    typeof version.tempOverride !== "number" &&
    typeof version.topPOverride !== "number"
  ) {
    return "none";
  }
  return `${version.modelOverride || "model—"} · temp ${
    typeof version.tempOverride === "number" ? version.tempOverride : "—"
  } · top_p ${
    typeof version.topPOverride === "number" ? version.topPOverride : "—"
  }`;
};

const statusColorPalette = (status: "SUCCESS" | "ERROR" | "PARTIAL") => {
  if (status === "SUCCESS") return "green";
  if (status === "ERROR") return "red";
  return "gray";
};

const RouterLink = styled(A, link);

export const PromptDetailPage: VoidComponent = () => {
  const params = useParams();
  const [prompt, { refetch: refetchPrompt }] = createResource(
    () => params.id,
    fetchPrompt
  );
  const [runs] = createResource(() => params.id, fetchRunsForPrompt);

  // Edit → Create New Version state
  const [editTemplate, setEditTemplate] = createSignal<string>("");
  const [editSystem, setEditSystem] = createSignal<string>("");
  const [editBusy, setEditBusy] = createSignal(false);
  const [editInited, setEditInited] = createSignal(false);

  // Defaults edit state
  const [defModel, setDefModel] = createSignal<string>("");
  const [defTemp, setDefTemp] = createSignal<string>("");
  const [defTopP, setDefTopP] = createSignal<string>("");
  const [savingDefaults, setSavingDefaults] = createSignal(false);

  // Revise with feedback state
  const [feedback, setFeedback] = createSignal<string>("");
  const [reviseBusy, setReviseBusy] = createSignal(false);
  const [suggestedTemplate, setSuggestedTemplate] = createSignal<string>("");
  const [suggestedSystem, setSuggestedSystem] = createSignal<string>("");

  onMount(() => {
    createEffect(() => {
      const p = prompt();
      if (!p) return;
      // Initialize defaults editor
      setDefModel(p.defaultModel || "");
      setDefTemp(String(p.defaultTemp ?? ""));
      setDefTopP(
        typeof p.defaultTopP === "number" ? String(p.defaultTopP) : ""
      );
      if (!p.activeVersion || editInited()) return;
      setEditTemplate(p.activeVersion.template || "");
      setEditSystem(p.activeVersion.system || "");
      setEditInited(true);
      console.log("[ai-prompt-detail] init edit from active version");
    });
  });

  const saveDefaults = async () => {
    if (!prompt()) return;
    const id = prompt()!.id;
    const payload: {
      defaultModel?: string;
      defaultTemp?: number;
      defaultTopP?: number | null;
    } = {};
    if (defModel().trim().length) payload.defaultModel = defModel().trim();
    const t = Number(defTemp());
    if (!Number.isNaN(t)) payload.defaultTemp = t;
    const tp = defTopP().trim().length ? Number(defTopP()) : NaN;
    if (!Number.isNaN(tp)) payload.defaultTopP = tp;
    if (defTopP().trim().length === 0) payload.defaultTopP = null;
    setSavingDefaults(true);
    try {
      const res = await apiFetch(`/api/prompts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("[ai-prompt-detail] save defaults status", res.status);
      await refetchPrompt();
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleCreateVersion = async (activate: boolean) => {
    if (!prompt()) return;
    const id = prompt()!.id;
    const template = editTemplate().trim();
    const system = editSystem().trim();
    if (!template) return;
    setEditBusy(true);
    try {
      const res = await apiFetch(`/api/prompts/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          system: system || undefined,
          activate,
        }),
      });
      console.log("[ai-prompt-detail] create version status", res.status);
      // Refresh prompt data
      await refetchPrompt();
    } finally {
      setEditBusy(false);
    }
  };

  const handleRevise = async () => {
    if (!prompt()) return;
    const id = prompt()!.id;
    const fb = feedback().trim();
    if (!fb) return;
    setReviseBusy(true);
    try {
      const res = await apiFetch(`/api/prompts/${id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: fb }),
      });
      const data = (await res.json()) as {
        suggestion?: { template: string; system?: string | null };
        error?: string;
      };
      if (data?.error || !data?.suggestion) {
        console.log(
          "[ai-prompt-detail] revise error:",
          data?.error || "unknown"
        );
        return;
      }
      setSuggestedTemplate(data.suggestion.template || "");
      setSuggestedSystem(data.suggestion.system || "");
      console.log("[ai-prompt-detail] got suggestion");
    } finally {
      setReviseBusy(false);
    }
  };

  const handleAcceptSuggestion = async (activate: boolean) => {
    if (!prompt()) return;
    const id = prompt()!.id;
    const template = suggestedTemplate().trim();
    const system = suggestedSystem().trim();
    if (!template) return;
    setReviseBusy(true);
    try {
      const res = await apiFetch(`/api/prompts/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          system: system || undefined,
          activate,
        }),
      });
      console.log("[ai-prompt-detail] accept suggestion status", res.status);
      await refetchPrompt();
      setSuggestedTemplate("");
      setSuggestedSystem("");
      setFeedback("");
    } finally {
      setReviseBusy(false);
    }
  };

  const handleCreateDraft = () => {
    handleCreateVersion(false);
  };

  const handleCreateAndActivate = () => {
    handleCreateVersion(true);
  };

  const handleAcceptDraft = () => {
    handleAcceptSuggestion(false);
  };

  const handleAcceptAndActivate = () => {
    handleAcceptSuggestion(true);
  };

  const handleDefTempInput = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    setDefTemp(target.value || "");
  };

  const handleDefTopPInput = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    setDefTopP(target.value || "");
  };

  const handleEditTemplateInput = (e: Event) => {
    const target = e.currentTarget as HTMLTextAreaElement;
    setEditTemplate(target.value);
  };

  const handleEditSystemInput = (e: Event) => {
    const target = e.currentTarget as HTMLTextAreaElement;
    setEditSystem(target.value);
  };

  const handleFeedbackInput = (e: Event) => {
    const target = e.currentTarget as HTMLTextAreaElement;
    setFeedback(target.value);
  };

  const handleSuggestedTemplateInput = (e: Event) => {
    const target = e.currentTarget as HTMLTextAreaElement;
    setSuggestedTemplate(target.value);
  };

  const handleSuggestedSystemInput = (e: Event) => {
    const target = e.currentTarget as HTMLTextAreaElement;
    setSuggestedSystem(target.value);
  };

  const LoadingInline = (props: { label?: string | undefined }) => {
    return (
      <HStack gap="2">
        <Spinner />
        <Text textStyle="sm" color="fg.muted">
          {props.label || "Loading…"}
        </Text>
      </HStack>
    );
  };

  return (
    <Box as="main" minH="screen" bg="bg.default">
      <Container py="6" px={{ base: "4", md: "6" }}>
        <Stack gap="6">
          <RouterLink href="/ai" textStyle="sm">
            ← Back to AI Dashboard
          </RouterLink>

          <ErrorBoundary
            fallback={(err, reset) => (
              <Card.Root>
                <Card.Header>
                  <Heading as="h2" fontSize="lg">
                    Prompt unavailable
                  </Heading>
                </Card.Header>
                <Card.Body>
                  <Stack gap="3">
                    <Text textStyle="sm" color="fg.muted">
                      Something went wrong while loading this prompt.
                    </Text>
                    <Text textStyle="xs" color="fg.muted">
                      {err?.message || "Unknown error"}
                    </Text>
                    <Button size="sm" variant="outline" onClick={reset}>
                      Try again
                    </Button>
                  </Stack>
                </Card.Body>
              </Card.Root>
            )}
          >
            <Suspense fallback={<LoadingInline label="Loading prompt…" />}>
              <Show when={prompt()}>
                {(p) => (
                  <Stack gap="6">
                    <Flex
                      align="center"
                      justify="space-between"
                      gap="3"
                      flexWrap="wrap"
                    >
                      <Stack gap="1">
                        <Heading as="h1" fontSize="2xl">
                          {p().task}
                        </Heading>
                        <Text textStyle="sm" color="fg.muted">
                          {p().description || "—"}
                        </Text>
                      </Stack>
                    </Flex>

                    <Grid
                      gap="6"
                      gridTemplateColumns={{
                        base: "1fr",
                        lg: "minmax(0, 2fr) minmax(0, 1fr)",
                      }}
                    >
                      <Stack gap="4">
                        <Card.Root>
                          <Card.Header>
                            <Heading as="h2" fontSize="lg">
                              Defaults
                            </Heading>
                          </Card.Header>
                          <Card.Body>
                            <Stack gap="2">
                              <Text as="div" textStyle="sm" color="fg.default">
                                <Text as="span" color="fg.muted">
                                  Model:
                                </Text>
                                <Text as="span" fontWeight="medium">
                                  {p().defaultModel}
                                </Text>
                              </Text>
                              <Text as="div" textStyle="sm" color="fg.default">
                                <Text as="span" color="fg.muted">
                                  Temp:
                                </Text>
                                <Text as="span" fontWeight="medium">
                                  {p().defaultTemp}
                                </Text>
                                <Show when={typeof p().defaultTopP === "number"}>
                                  {(v) => (
                                    <Text as="span" color="fg.muted">
                                      {" "}· TopP:{" "}
                                      <Text as="span" fontWeight="medium">
                                        {String(v())}
                                      </Text>
                                    </Text>
                                  )}
                                </Show>
                              </Text>
                            </Stack>
                          </Card.Body>
                        </Card.Root>

                        <Card.Root>
                          <Card.Header>
                            <Heading as="h2" fontSize="lg">
                              Edit defaults
                            </Heading>
                          </Card.Header>
                          <Card.Body>
                            <Grid
                              gap="3"
                              gridTemplateColumns={{
                                base: "1fr",
                                md: "repeat(3, minmax(0, 1fr))",
                              }}
                            >
                              <Stack gap="1">
                                <Text textStyle="xs" color="fg.muted">
                                  Model
                                </Text>
                                <ModelSelect
                                  value={defModel()}
                                  onChange={(v) => setDefModel(v)}
                                />
                              </Stack>
                              <Stack gap="1">
                                <Text textStyle="xs" color="fg.muted">
                                  Temp
                                </Text>
                                <Input
                                  value={defTemp()}
                                  onInput={handleDefTempInput}
                                  size="sm"
                                />
                              </Stack>
                              <Stack gap="1">
                                <Text textStyle="xs" color="fg.muted">
                                  TopP
                                </Text>
                                <Input
                                  value={defTopP()}
                                  onInput={handleDefTopPInput}
                                  placeholder="optional"
                                  size="sm"
                                />
                              </Stack>
                            </Grid>
                            <HStack mt="3" gap="2" flexWrap="wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                loading={savingDefaults()}
                                onClick={saveDefaults}
                              >
                                Save Defaults
                              </Button>
                            </HStack>
                          </Card.Body>
                        </Card.Root>

                        <Card.Root>
                          <Card.Header>
                            <Heading as="h2" fontSize="lg">
                              Active Version
                            </Heading>
                          </Card.Header>
                          <Card.Body>
                            <Show
                              when={p().activeVersion}
                              fallback={
                                <Text textStyle="sm" color="fg.muted">
                                  —
                                </Text>
                              }
                            >
                              {(av) => (
                                <Stack gap="2">
                                  <Text
                                    fontFamily="mono"
                                    textStyle="sm"
                                    color="fg.default"
                                  >
                                    {av().id}
                                  </Text>
                                  <Text textStyle="xs" color="fg.muted">
                                    Overrides: {formatOverrides(av())}
                                  </Text>
                                  <Box as="details">
                                    <Box
                                      as="summary"
                                      cursor="pointer"
                                      textStyle="xs"
                                      color="fg.muted"
                                    >
                                      Template
                                    </Box>
                                    <Box
                                      as="pre"
                                      mt="2"
                                      p="2"
                                      borderWidth="1px"
                                      borderColor="border"
                                      borderRadius="l2"
                                      bg="gray.surface.bg.hover"
                                      fontSize="xs"
                                      fontFamily="mono"
                                      whiteSpace="pre-wrap"
                                    >
                                      {av().template}
                                    </Box>
                                  </Box>
                                  <Show when={av().system}>
                                    {(s) => (
                                      <Box as="details">
                                        <Box
                                          as="summary"
                                          cursor="pointer"
                                          textStyle="xs"
                                          color="fg.muted"
                                        >
                                          System
                                        </Box>
                                        <Box
                                          as="pre"
                                          mt="2"
                                          p="2"
                                          borderWidth="1px"
                                          borderColor="border"
                                          borderRadius="l2"
                                          bg="gray.surface.bg.hover"
                                          fontSize="xs"
                                          fontFamily="mono"
                                          whiteSpace="pre-wrap"
                                        >
                                          {s()}
                                        </Box>
                                      </Box>
                                    )}
                                  </Show>
                                </Stack>
                              )}
                            </Show>
                          </Card.Body>
                        </Card.Root>

                        <Card.Root>
                          <Card.Header>
                            <Heading as="h2" fontSize="lg">
                              Edit → New Version
                            </Heading>
                          </Card.Header>
                          <Card.Body>
                            <Show
                              when={p().activeVersion}
                              fallback={
                                <Text textStyle="sm" color="fg.muted">
                                  No active version yet.
                                </Text>
                              }
                            >
                              <Stack gap="3">
                                <Stack gap="1">
                                  <Text textStyle="xs" color="fg.muted">
                                    Template (Mustache)
                                  </Text>
                                  <Textarea
                                    value={editTemplate()}
                                    onInput={handleEditTemplateInput}
                                    size="sm"
                                    minH="10rem"
                                    fontFamily="mono"
                                  />
                                </Stack>
                                <Stack gap="1">
                                  <Text textStyle="xs" color="fg.muted">
                                    System (optional)
                                  </Text>
                                  <Textarea
                                    value={editSystem()}
                                    onInput={handleEditSystemInput}
                                    size="sm"
                                    minH="6rem"
                                    fontFamily="mono"
                                  />
                                </Stack>
                                <HStack gap="2" flexWrap="wrap">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    loading={editBusy()}
                                    onClick={handleCreateDraft}
                                  >
                                    Save as New Version
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="solid"
                                    colorPalette="green"
                                    loading={editBusy()}
                                    onClick={handleCreateAndActivate}
                                  >
                                    Save & Activate
                                  </Button>
                                </HStack>
                              </Stack>
                            </Show>
                          </Card.Body>
                        </Card.Root>

                        <Card.Root>
                          <Card.Header>
                            <Heading as="h2" fontSize="lg">
                              Revise with Feedback (LLM)
                            </Heading>
                          </Card.Header>
                          <Card.Body>
                            <Stack gap="3">
                              <Stack gap="1">
                                <Text textStyle="xs" color="fg.muted">
                                  Feedback
                                </Text>
                                <Textarea
                                  value={feedback()}
                                  onInput={handleFeedbackInput}
                                  placeholder="Describe what to improve. E.g., 'Make headings consistent, add examples, keep {{selection}} intact.'"
                                  size="sm"
                                  minH="6rem"
                                />
                              </Stack>
                              <HStack gap="2" flexWrap="wrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  loading={reviseBusy()}
                                  onClick={handleRevise}
                                >
                                  Generate Suggestion
                                </Button>
                              </HStack>
                              <Show when={suggestedTemplate().length > 0}>
                                <Stack gap="3">
                                  <Stack gap="1">
                                    <Text textStyle="xs" color="fg.muted">
                                      Suggested Template
                                    </Text>
                                    <Textarea
                                      value={suggestedTemplate()}
                                      onInput={handleSuggestedTemplateInput}
                                      size="sm"
                                      minH="10rem"
                                      fontFamily="mono"
                                    />
                                  </Stack>
                                  <Stack gap="1">
                                    <Text textStyle="xs" color="fg.muted">
                                      Suggested System (optional)
                                    </Text>
                                    <Textarea
                                      value={suggestedSystem()}
                                      onInput={handleSuggestedSystemInput}
                                      size="sm"
                                      minH="6rem"
                                      fontFamily="mono"
                                    />
                                  </Stack>
                                  <HStack gap="2" flexWrap="wrap">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      loading={reviseBusy()}
                                      onClick={handleAcceptDraft}
                                    >
                                      Accept → New Version
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="solid"
                                      colorPalette="green"
                                      loading={reviseBusy()}
                                      onClick={handleAcceptAndActivate}
                                    >
                                      Accept → New Version & Activate
                                    </Button>
                                  </HStack>
                                </Stack>
                              </Show>
                            </Stack>
                          </Card.Body>
                        </Card.Root>

                        <Card.Root>
                          <Card.Header>
                            <Heading as="h2" fontSize="lg">
                              All Versions
                            </Heading>
                          </Card.Header>
                          <Card.Body>
                            <Stack gap="3">
                              <For each={p().versions}>
                                {(v) => (
                                  <Box
                                    borderWidth="1px"
                                    borderColor="border"
                                    borderRadius="l2"
                                    p="3"
                                  >
                                    <Stack gap="2">
                                      <Stack gap="0.5">
                                        <Text
                                          fontFamily="mono"
                                          textStyle="sm"
                                          color="fg.default"
                                        >
                                          {v.id}
                                        </Text>
                                        <Text textStyle="xs" color="fg.muted">
                                          {new Date(v.createdAt).toLocaleString()}
                                        </Text>
                                      </Stack>
                                      <Text textStyle="xs" color="fg.muted">
                                        Overrides: {formatOverrides(v)}
                                      </Text>
                                      <Box as="details">
                                        <Box
                                          as="summary"
                                          cursor="pointer"
                                          textStyle="xs"
                                          color="fg.muted"
                                        >
                                          Template
                                        </Box>
                                        <Box
                                          as="pre"
                                          mt="2"
                                          p="2"
                                          borderWidth="1px"
                                          borderColor="border"
                                          borderRadius="l2"
                                          bg="gray.surface.bg.hover"
                                          fontSize="xs"
                                          fontFamily="mono"
                                          whiteSpace="pre-wrap"
                                        >
                                          {v.template}
                                        </Box>
                                      </Box>
                                      <Show when={v.system}>
                                        {(s) => (
                                          <Box as="details">
                                            <Box
                                              as="summary"
                                              cursor="pointer"
                                              textStyle="xs"
                                              color="fg.muted"
                                            >
                                              System
                                            </Box>
                                            <Box
                                              as="pre"
                                              mt="2"
                                              p="2"
                                              borderWidth="1px"
                                              borderColor="border"
                                              borderRadius="l2"
                                              bg="gray.surface.bg.hover"
                                              fontSize="xs"
                                              fontFamily="mono"
                                              whiteSpace="pre-wrap"
                                            >
                                              {s()}
                                            </Box>
                                          </Box>
                                        )}
                                      </Show>
                                    </Stack>
                                  </Box>
                                )}
                              </For>
                            </Stack>
                          </Card.Body>
                        </Card.Root>
                      </Stack>

                      <Stack gap="3">
                        <Card.Root>
                          <Card.Header>
                            <Heading as="h2" fontSize="lg">
                              Recent Runs
                            </Heading>
                          </Card.Header>
                          <Card.Body>
                            <Suspense
                              fallback={<LoadingInline label="Loading runs…" />}
                            >
                              <Show
                                when={(runs() || []).length > 0}
                                fallback={
                                  <Text textStyle="sm" color="fg.muted">
                                    No runs yet.
                                  </Text>
                                }
                              >
                                <Box
                                  borderWidth="1px"
                                  borderColor="border"
                                  borderRadius="l2"
                                  overflowX="auto"
                                >
                                  <Table.Root variant="surface" interactive>
                                    <Table.Head>
                                      <Table.Row>
                                        <Table.Header>Run</Table.Header>
                                        <Table.Header>Model</Table.Header>
                                        <Table.Header>Status</Table.Header>
                                        <Table.Header>Created</Table.Header>
                                        <Table.Header textAlign="right">
                                          View
                                        </Table.Header>
                                      </Table.Row>
                                    </Table.Head>
                                    <Table.Body>
                                      <For each={runs() || []}>
                                        {(r) => (
                                          <Table.Row>
                                            <Table.Cell>
                                              <Text
                                                as="div"
                                                fontFamily="mono"
                                                color="fg.default"
                                              >
                                                {r.id.slice(0, 8)}
                                              </Text>
                                            </Table.Cell>
                                            <Table.Cell>
                                              <Text as="span" color="fg.default">
                                                {r.model}
                                              </Text>
                                            </Table.Cell>
                                            <Table.Cell>
                                              <Badge
                                                size="sm"
                                                variant="subtle"
                                                colorPalette={statusColorPalette(
                                                  r.status
                                                )}
                                              >
                                                {r.status}
                                              </Badge>
                                            </Table.Cell>
                                            <Table.Cell>
                                              <Text as="span" color="fg.default">
                                                {new Date(
                                                  r.createdAt
                                                ).toLocaleString()}
                                              </Text>
                                            </Table.Cell>
                                            <Table.Cell textAlign="right">
                                              <RouterLink
                                                href={`/ai/runs/${r.id}`}
                                              >
                                                View
                                              </RouterLink>
                                            </Table.Cell>
                                          </Table.Row>
                                        )}
                                      </For>
                                    </Table.Body>
                                  </Table.Root>
                                </Box>
                              </Show>
                            </Suspense>
                          </Card.Body>
                        </Card.Root>
                      </Stack>
                    </Grid>
                  </Stack>
                )}
              </Show>
            </Suspense>
          </ErrorBoundary>
        </Stack>
      </Container>
    </Box>
  );
};

export default PromptDetailPage;
