import {
  type VoidComponent,
  type JSX,
  For,
  Show,
  Suspense,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";
import { A } from "@solidjs/router";
import { Portal } from "solid-js/web";
import { apiFetch } from "~/utils/base-url";
import { Badge } from "~/components/ui/badge";
import * as Card from "~/components/ui/card";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import * as Select from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import * as Table from "~/components/ui/table";
import { Text } from "~/components/ui/text";
import { Box, Container, Flex, Grid, HStack, Spacer, Stack } from "styled-system/jsx";
import { styled } from "styled-system/jsx";
import { link } from "styled-system/recipes";

type Prompt = {
  id: string;
  task: string;
  description?: string | null;
  defaultModel: string;
  defaultTemp: number;
  defaultTopP?: number | null;
  activeVersion?: {
    id: string;
    template: string;
    system?: string | null;
  } | null;
};
type PromptsResponse = { items: Prompt[] };

type RunStatus = "SUCCESS" | "ERROR" | "PARTIAL";
type PromptRunItem = {
  id: string;
  status: RunStatus;
  model: string;
  createdAt: string;
  error?: string | null;
  promptVersionId: string;
  compiledPrompt: string;
  systemUsed?: string | null;
  outputHtml?: string | null;
  rawResponse?: unknown | null;
  inputVars?: Record<string, unknown> | null;
  promptId?: string | null;
  promptTask?: string | null;
  versionId?: string | null;
};
type RunsResponse = { items: PromptRunItem[] };

async function fetchPrompts(): Promise<Prompt[]> {
  const res = await apiFetch("/api/prompts");
  const data = (await res.json()) as PromptsResponse;
  console.log("[ai-dashboard] prompts loaded", data.items?.length || 0);
  return data.items || [];
}

async function fetchRuns(): Promise<PromptRunItem[]> {
  const res = await apiFetch("/api/ai/runs?limit=100");
  const data = (await res.json()) as RunsResponse;
  console.log("[ai-dashboard] runs loaded", data.items?.length || 0);
  return data.items || [];
}

type StatusFilter = "ALL" | RunStatus;
type StatusOption = { label: string; value: StatusFilter };
const STATUS_OPTIONS: StatusOption[] = [
  { label: "All", value: "ALL" },
  { label: "Success", value: "SUCCESS" },
  { label: "Error", value: "ERROR" },
  { label: "Partial", value: "PARTIAL" },
];

const parseStatusFilter = (value: string): StatusFilter => {
  if (value === "SUCCESS") return "SUCCESS";
  if (value === "ERROR") return "ERROR";
  if (value === "PARTIAL") return "PARTIAL";
  return "ALL";
};

const statusColorPalette = (status: RunStatus) => {
  if (status === "SUCCESS") return "green";
  if (status === "ERROR") return "red";
  return "gray";
};

const RouterLink = styled(A, link);

const AiDashboard: VoidComponent = () => {
  const [prompts] = createResource(fetchPrompts);
  const [runs] = createResource(fetchRuns);

  const [statusFilter, setStatusFilter] = createSignal<StatusFilter>("ALL");
  const [query, setQuery] = createSignal("");

  const filteredRuns = createMemo(() => {
    const items = runs() || [];
    const q = query().trim().toLowerCase();
    const status = statusFilter();
    return items.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (!q) return true;
      const hay =
        `${r.id} ${r.promptTask || ""} ${r.model} ${r.error || ""}`.toLowerCase();
      return hay.includes(q);
    });
  });

  const metrics = createMemo(() => {
    const ps = prompts() || [];
    const rs = runs() || [];
    const total = rs.length;
    const success = rs.filter((r) => r.status === "SUCCESS").length;
    const error = rs.filter((r) => r.status === "ERROR").length;
    const partial = rs.filter((r) => r.status === "PARTIAL").length;
    const byModel = new Map<string, number>();
    for (const r of rs) {
      byModel.set(r.model, (byModel.get(r.model) || 0) + 1);
    }
    let topModel = "";
    let topCount = 0;
    for (const [m, c] of byModel.entries()) {
      if (c > topCount) {
        topModel = m;
        topCount = c;
      }
    }
    return {
      promptCount: ps.length,
      runCount: total,
      success,
      error,
      partial,
      successRate: total ? Math.round((success / total) * 100) : 0,
      topModel,
      topModelCount: topCount,
    };
  });

  const promptIdToRunCount = createMemo(() => {
    const map = new Map<string, number>();
    for (const r of runs() || []) {
      const pid = r.promptId || "";
      if (!pid) continue;
      map.set(pid, (map.get(pid) || 0) + 1);
    }
    return map;
  });

  const handleQueryInput = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    setQuery(target.value);
  };

  const statusCollection = Select.createListCollection<StatusOption>({
    items: STATUS_OPTIONS,
  });

  const handleStatusValueChange = (details: Select.ValueChangeDetails<StatusOption>) => {
    setStatusFilter(parseStatusFilter(details.value?.[0] || "ALL"));
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

  const MetricCard = (props: {
    label: string;
    value: string | number | JSX.Element;
    footer?: JSX.Element | undefined;
  }) => {
    return (
      <Card.Root>
        <Card.Body>
          <Stack gap="1">
            <Text as="div" textStyle="xs" color="fg.muted">
              {props.label}
            </Text>
            <Text as="div" textStyle="2xl" fontWeight="semibold" color="fg.default">
              {props.value}
            </Text>
            <Show when={props.footer}>{(f) => <Box>{f()}</Box>}</Show>
          </Stack>
        </Card.Body>
      </Card.Root>
    );
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="6" px="4" maxW="1200px">
        <Stack gap="6">
          <Flex
            align="center"
            justify="space-between"
            gap="3"
            flexWrap="wrap"
          >
            <Heading as="h1" fontSize="2xl">
              AI Dashboard
            </Heading>
            <HStack gap="2" flexWrap="wrap" alignItems="center">
              <Input
                size="sm"
                placeholder="Search runs by id, task, model…"
                value={query()}
                onInput={handleQueryInput}
                autocomplete="off"
                autocapitalize="none"
                autocorrect="off"
                spellcheck={false}
              />
              <Select.Root
                collection={statusCollection}
                value={[statusFilter()]}
                onValueChange={handleStatusValueChange}
                size="sm"
              >
                <Select.Control>
                  <Select.Trigger>
                    <Select.ValueText placeholder="Status" />
                    <Select.Indicator />
                  </Select.Trigger>
                </Select.Control>
                <Portal>
                  <Select.Positioner>
                    <Select.Content>
                      <Select.List>
                        <For each={statusCollection.items}>
                          {(opt) => (
                            <Select.Item item={opt}>
                              <Select.ItemText>{opt.label}</Select.ItemText>
                              <Select.ItemIndicator />
                            </Select.Item>
                          )}
                        </For>
                      </Select.List>
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
                <Select.HiddenSelect />
              </Select.Root>
            </HStack>
          </Flex>

          <Suspense fallback={<LoadingInline />}>
            <Grid
              gap="3"
              gridTemplateColumns={{
                base: "repeat(2, minmax(0, 1fr))",
                md: "repeat(4, minmax(0, 1fr))",
              }}
            >
              <MetricCard label="Prompts" value={metrics().promptCount} />
              <MetricCard label="Runs (recent)" value={metrics().runCount} />
              <MetricCard
                label="Success rate"
                value={`${metrics().successRate}%`}
              />
              <MetricCard
                label="Top model"
                value={
                  <Show
                    when={metrics().topModel}
                    fallback={<Text as="span">—</Text>}
                  >
                    {(m) => (
                      <HStack gap="1.5">
                        <Text as="span" fontWeight="semibold" color="fg.default">
                          {m()}
                        </Text>
                        <Text as="span" textStyle="sm" color="fg.muted">
                          ({metrics().topModelCount})
                        </Text>
                      </HStack>
                    )}
                  </Show>
                }
              />
            </Grid>
          </Suspense>

          <Grid
            gap="6"
            gridTemplateColumns={{
              base: "1fr",
              lg: "repeat(2, minmax(0, 1fr))",
            }}
          >
            <Card.Root>
              <Card.Header>
                <HStack>
                  <Heading as="h2" fontSize="lg">
                    Prompts
                  </Heading>
                  <Spacer />
                </HStack>
              </Card.Header>
              <Card.Body>
                <Box
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="l2"
                  overflowX="auto"
                >
                  <Suspense fallback={<LoadingInline />}>
                    <Table.Root variant="surface" interactive>
                      <Table.Head>
                        <Table.Row>
                          <Table.Header>Task</Table.Header>
                          <Table.Header>Active Version</Table.Header>
                          <Table.Header>Default</Table.Header>
                          <Table.Header textAlign="right">Runs</Table.Header>
                        </Table.Row>
                      </Table.Head>
                      <Table.Body>
                        <For each={prompts() || []}>
                          {(p) => (
                            <Table.Row>
                              <Table.Cell>
                                <Stack gap="1">
                                  <Text
                                    as="div"
                                    fontWeight="medium"
                                    color="fg.default"
                                  >
                                    <RouterLink href={`/ai/prompts/${p.id}`}>
                                      {p.task}
                                    </RouterLink>
                                  </Text>
                                  <Text as="div" textStyle="xs" color="fg.muted">
                                    {p.description || "—"}
                                  </Text>
                                </Stack>
                              </Table.Cell>
                              <Table.Cell>
                                <Stack gap="1">
                                  <Text
                                    as="div"
                                    fontFamily="mono"
                                    fontSize="xs"
                                    color="fg.default"
                                  >
                                    {p.activeVersion?.id || "—"}
                                  </Text>
                                  <Show when={p.activeVersion}>
                                    {(av) => (
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
                                          fontSize="xs"
                                          bg="bg.subtle"
                                          borderWidth="1px"
                                          borderColor="border"
                                          borderRadius="l2"
                                          whiteSpace="pre-wrap"
                                        >
                                          {av().template}
                                        </Box>
                                      </Box>
                                    )}
                                  </Show>
                                </Stack>
                              </Table.Cell>
                              <Table.Cell>
                                <Stack gap="1">
                                  <Text as="div" color="fg.default">
                                    {p.defaultModel}
                                  </Text>
                                  <Text as="div" textStyle="xs" color="fg.muted">
                                    temp {p.defaultTemp}
                                    <Show
                                      when={typeof p.defaultTopP === "number"}
                                    >
                                      {(v) => (
                                        <Text
                                          as="span"
                                          textStyle="xs"
                                          color="fg.muted"
                                        >
                                          {" "}
                                          · top_p {String(v())}
                                        </Text>
                                      )}
                                    </Show>
                                  </Text>
                                </Stack>
                              </Table.Cell>
                              <Table.Cell textAlign="right">
                                <Text
                                  as="span"
                                  fontVariantNumeric="tabular-nums"
                                >
                                  {promptIdToRunCount().get(p.id) || 0}
                                </Text>
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </For>
                      </Table.Body>
                    </Table.Root>
                  </Suspense>
                </Box>
              </Card.Body>
            </Card.Root>

            <Card.Root>
              <Card.Header>
                <HStack>
                  <Heading as="h2" fontSize="lg">
                    Recent Runs
                  </Heading>
                  <Spacer />
                </HStack>
              </Card.Header>
              <Card.Body>
                <Box
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="l2"
                  overflowX="auto"
                >
                  <Suspense fallback={<LoadingInline />}>
                    <Table.Root variant="surface" interactive>
                      <Table.Head>
                        <Table.Row>
                          <Table.Header>Run</Table.Header>
                          <Table.Header>Task</Table.Header>
                          <Table.Header>Model</Table.Header>
                          <Table.Header>Status</Table.Header>
                          <Table.Header>Created</Table.Header>
                          <Table.Header textAlign="right">Details</Table.Header>
                        </Table.Row>
                      </Table.Head>
                      <Table.Body>
                        <For each={filteredRuns()}>
                          {(r) => (
                            <Table.Row>
                              <Table.Cell>
                                <Text
                                  as="div"
                                  fontFamily="mono"
                                  color="fg.default"
                                >
                                  <RouterLink href={`/ai/runs/${r.id}`}>
                                    {r.id.slice(0, 8)}
                                  </RouterLink>
                                </Text>
                              </Table.Cell>
                              <Table.Cell>
                                <Text as="span" color="fg.default">
                                  {r.promptTask || "—"}
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
                                  colorPalette={statusColorPalette(r.status)}
                                >
                                  {r.status}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell>
                                <Text as="span" color="fg.default">
                                  {new Date(r.createdAt).toLocaleString()}
                                </Text>
                              </Table.Cell>
                              <Table.Cell textAlign="right">
                                <HStack
                                  gap="3"
                                  justify="flex-end"
                                  alignItems="flex-start"
                                >
                                  <RouterLink href={`/ai/runs/${r.id}`}>
                                    Open
                                  </RouterLink>
                                  <Box as="details">
                                    <Box
                                      as="summary"
                                      cursor="pointer"
                                      color="fg.muted"
                                      textStyle="sm"
                                    >
                                      View
                                    </Box>
                                    <Stack mt="2" gap="2" minW="24rem">
                                      <Box>
                                        <Text
                                          as="div"
                                          textStyle="xs"
                                          color="fg.muted"
                                        >
                                          Compiled Prompt
                                        </Text>
                                        <Box
                                          as="pre"
                                          mt="1"
                                          p="2"
                                          fontSize="xs"
                                          bg="bg.subtle"
                                          borderWidth="1px"
                                          borderColor="border"
                                          borderRadius="l2"
                                          whiteSpace="pre-wrap"
                                        >
                                          {r.compiledPrompt}
                                        </Box>
                                      </Box>
                                      <Show when={r.systemUsed}>
                                        {(s) => (
                                          <Box>
                                            <Text
                                              as="div"
                                              textStyle="xs"
                                              color="fg.muted"
                                            >
                                              System
                                            </Text>
                                            <Box
                                              as="pre"
                                              mt="1"
                                              p="2"
                                              fontSize="xs"
                                              bg="bg.subtle"
                                              borderWidth="1px"
                                              borderColor="border"
                                              borderRadius="l2"
                                              whiteSpace="pre-wrap"
                                            >
                                              {s()}
                                            </Box>
                                          </Box>
                                        )}
                                      </Show>
                                      <Box>
                                        <Text
                                          as="div"
                                          textStyle="xs"
                                          color="fg.muted"
                                        >
                                          Output (HTML)
                                        </Text>
                                        <Box
                                          mt="1"
                                          p="2"
                                          fontSize="xs"
                                          bg="bg.subtle"
                                          borderWidth="1px"
                                          borderColor="border"
                                          borderRadius="l2"
                                          whiteSpace="pre-wrap"
                                        >
                                          <Show
                                            when={r.outputHtml}
                                            fallback={<Text as="span">—</Text>}
                                          >
                                            {(h) => <Box innerHTML={h()} />}
                                          </Show>
                                        </Box>
                                      </Box>
                                      <Show when={r.error}>
                                        {(e) => (
                                          <Text as="div" textStyle="xs" color="error">
                                            Error: {e()}
                                          </Text>
                                        )}
                                      </Show>
                                    </Stack>
                                  </Box>
                                </HStack>
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </For>
                      </Table.Body>
                    </Table.Root>
                  </Suspense>
                </Box>
              </Card.Body>
            </Card.Root>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
};

export default AiDashboard;


