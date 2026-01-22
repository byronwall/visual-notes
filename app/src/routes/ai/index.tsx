import {
  type VoidComponent,
  type JSX,
  For,
  Show,
  Suspense,
  createMemo,
  createSignal,
} from "solid-js";
import { A, createAsync, revalidate, useAction } from "@solidjs/router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import * as Card from "~/components/ui/card";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Spinner } from "~/components/ui/spinner";
import * as Table from "~/components/ui/table";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import {
  Box,
  Container,
  Flex,
  Grid,
  HStack,
  Spacer,
  Stack,
} from "styled-system/jsx";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";
import { link } from "styled-system/recipes";
import { fetchPrompts } from "~/services/prompts/prompts.queries";
import { fetchPromptRuns } from "~/services/ai/ai-runs.queries";
import { deletePrompt, updatePrompt } from "~/services/prompts/prompts.actions";

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
const promptDescClass = css({
  lineClamp: "2",
});

const AiDashboard: VoidComponent = () => {
  const prompts = createAsync(() => fetchPrompts());
  const runs = createAsync((): Promise<PromptRunItem[]> =>
    fetchPromptRuns({ limit: 100 })
  );
  const runUpdatePrompt = useAction(updatePrompt);
  const runDeletePrompt = useAction(deletePrompt);

  const refreshPrompts = async () => {
    await revalidate(fetchPrompts.key);
  };

  const [statusFilter, setStatusFilter] = createSignal<StatusFilter>("ALL");
  const [query, setQuery] = createSignal("");
  const [editOpen, setEditOpen] = createSignal(false);
  const [editId, setEditId] = createSignal<string | null>(null);
  const [editTask, setEditTask] = createSignal("");
  const [editDesc, setEditDesc] = createSignal("");
  const [editBusy, setEditBusy] = createSignal(false);
  const [editError, setEditError] = createSignal("");
  const [deleteOpen, setDeleteOpen] = createSignal(false);
  const [deleteId, setDeleteId] = createSignal<string | null>(null);
  const [deleteLabel, setDeleteLabel] = createSignal("");
  const [deleteBusy, setDeleteBusy] = createSignal(false);

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

  const handleStatusValueChange = (value: string) => {
    setStatusFilter(parseStatusFilter(value || "ALL"));
  };

  const openEditPrompt = (prompt: Prompt) => {
    setEditId(prompt.id);
    setEditTask(prompt.task);
    setEditDesc(prompt.description || "");
    setEditError("");
    setEditOpen(true);
  };

  const closeEditPrompt = () => {
    setEditOpen(false);
    setEditError("");
    setEditId(null);
  };

  const handleEditTaskInput = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    setEditTask(target.value);
  };

  const handleEditDescInput = (e: Event) => {
    const target = e.currentTarget as HTMLTextAreaElement;
    setEditDesc(target.value);
  };

  const saveEditPrompt = async () => {
    const id = editId();
    if (!id) return;
    const task = editTask().trim();
    if (!task) {
      setEditError("Name is required.");
      return;
    }
    setEditBusy(true);
    setEditError("");
    try {
      await runUpdatePrompt({
        id,
        task,
        description: editDesc().trim().length ? editDesc().trim() : null,
      });
      await refreshPrompts();
      setEditOpen(false);
    } catch (err) {
      setEditError((err as Error)?.message || "Failed to save prompt.");
    } finally {
      setEditBusy(false);
    }
  };

  const openDeletePrompt = (prompt: Prompt) => {
    setDeleteId(prompt.id);
    setDeleteLabel(prompt.task);
    setDeleteOpen(true);
  };

  const handleDeletePrompt = async () => {
    const id = deleteId();
    if (!id) return;
    setDeleteBusy(true);
    try {
      await runDeletePrompt({ id });
      console.log("[ai-dashboard] delete prompt ok");
      await refreshPrompts();
      setDeleteOpen(false);
    } finally {
      setDeleteBusy(false);
      setDeleteId(null);
    }
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
            <Text
              as="div"
              textStyle="2xl"
              fontWeight="semibold"
              color="fg.default"
            >
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
          <Flex align="center" justify="space-between" gap="3" flexWrap="wrap">
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
              <SimpleSelect
                items={STATUS_OPTIONS}
                value={statusFilter()}
                onChange={handleStatusValueChange}
                size="sm"
                placeholder="Status"
              />
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
                        <Text
                          as="span"
                          fontWeight="semibold"
                          color="fg.default"
                        >
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

          <Stack gap="6">
            <Box w="full" maxW="960px" mx="auto">
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
                            <Table.Header textAlign="right">
                              Actions
                            </Table.Header>
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
                                    <Text
                                      as="div"
                                      textStyle="xs"
                                      color="fg.muted"
                                      maxW="320px"
                                      class={promptDescClass}
                                    >
                                      {p.description || "—"}
                                    </Text>
                                  </Stack>
                                </Table.Cell>
                                <Table.Cell>
                                  <Text
                                    as="div"
                                    fontFamily="mono"
                                    fontSize="xs"
                                    color="fg.default"
                                  >
                                    {p.activeVersion?.id || "—"}
                                  </Text>
                                </Table.Cell>
                                <Table.Cell>
                                  <Stack gap="1">
                                    <Text as="div" color="fg.default">
                                      {p.defaultModel}
                                    </Text>
                                    <Text
                                      as="div"
                                      textStyle="xs"
                                      color="fg.muted"
                                    >
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
                                <Table.Cell textAlign="right">
                                  <HStack
                                    gap="2"
                                    justify="flex-end"
                                    alignItems="center"
                                  >
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      onClick={() => openEditPrompt(p)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      colorPalette="red"
                                      onClick={() => openDeletePrompt(p)}
                                    >
                                      Delete
                                    </Button>
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
            </Box>

            <Box w="full" maxW="960px" mx="auto">
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
                            <Table.Header textAlign="right">
                              Details
                            </Table.Header>
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
                                  <RouterLink href={`/ai/runs/${r.id}`}>
                                    Open
                                  </RouterLink>
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
            </Box>
          </Stack>
        </Stack>
      </Container>

      <SimpleDialog
        open={editOpen()}
        onOpenChange={setEditOpen}
        onClose={closeEditPrompt}
        title="Edit prompt"
        description="Update the name and description for this prompt."
        maxW="520px"
        footer={
          <HStack justify="flex-end" gap="2" w="full">
            <Button variant="outline" onClick={closeEditPrompt}>
              Cancel
            </Button>
            <Button loading={editBusy()} onClick={saveEditPrompt}>
              Save
            </Button>
          </HStack>
        }
      >
        <Stack gap="3">
          <Stack gap="1">
            <Text textStyle="xs" color="fg.muted">
              Name
            </Text>
            <Input value={editTask()} onInput={handleEditTaskInput} />
          </Stack>
          <Stack gap="1">
            <Text textStyle="xs" color="fg.muted">
              Description
            </Text>
            <Textarea
              value={editDesc()}
              onInput={handleEditDescInput}
              minH="6rem"
            />
          </Stack>
          <Show when={editError()}>
            {(err) => (
              <Text textStyle="xs" color="error">
                {err()}
              </Text>
            )}
          </Show>
        </Stack>
      </SimpleDialog>

      <ConfirmDialog
        open={deleteOpen()}
        onOpenChange={setDeleteOpen}
        title="Delete prompt"
        description={`Delete "${deleteLabel()}" and all of its versions and runs?`}
        confirmLabel={deleteBusy() ? "Deleting…" : "Delete prompt"}
        onConfirm={() => void handleDeletePrompt()}
      >
        <Text textStyle="sm" color="fg.muted">
          This action cannot be undone.
        </Text>
      </ConfirmDialog>
    </Box>
  );
};

export default AiDashboard;
