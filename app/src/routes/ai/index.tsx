import { createAsync, useSearchParams } from "@solidjs/router";
import { type VoidComponent, For, Show, Suspense, createMemo, createSignal } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { PromptDeleteDialog, PromptEditDialog } from "~/components/ai-dashboard/PromptDialogs";
import { PaidCallsTable } from "~/components/ai-dashboard/PaidCallsTable";
import { PromptsTable } from "~/components/ai-dashboard/PromptsTable";
import { RunsTable } from "~/components/ai-dashboard/RunsTable";
import {
  type DashboardPrompt,
  type DashboardRun,
  RUN_STATUS_FILTERS,
  parseRunStatusFilter,
  runMatchesQuery,
  statsByPrompt,
} from "~/components/ai-dashboard/ai-dashboard-model";
import { EmptyState } from "~/components/secondary/EmptyState";
import { SecondaryPageHeader } from "~/components/secondary/SecondaryPageHeader";
import { SecondarySection } from "~/components/secondary/SecondarySection";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { fetchPromptRuns } from "~/services/ai/ai-runs.queries";
import { fetchPrompts } from "~/services/prompts/prompts.queries";

const RUN_LIMIT = 100;

const AiDashboard: VoidComponent = () => {
  const prompts = createAsync(() => fetchPrompts() as Promise<DashboardPrompt[]>);
  const runs = createAsync(() => fetchPromptRuns({ limit: RUN_LIMIT }) as Promise<DashboardRun[]>);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = createSignal<DashboardPrompt | null>(null);
  const [deleting, setDeleting] = createSignal<DashboardPrompt | null>(null);

  const status = () => parseRunStatusFilter(typeof params.status === "string" ? params.status : undefined);
  const query = () => (typeof params.q === "string" ? params.q : "");

  // Read latest so revalidation does not flash the loading fallback.
  const promptList = () => prompts.latest ?? prompts();
  const runList = () => runs.latest ?? runs();
  const allRuns = () => runList() ?? [];
  const stats = createMemo(() => statsByPrompt(allRuns()));
  const statusCounts = createMemo(() => {
    const counts = { ALL: 0, SUCCESS: 0, ERROR: 0, PARTIAL: 0 };
    for (const run of allRuns()) {
      if (!runMatchesQuery(run, query())) continue;
      counts.ALL += 1;
      counts[run.status] += 1;
    }
    return counts;
  });
  const filteredRuns = createMemo(() =>
    allRuns().filter(
      (run) => (status() === "ALL" || run.status === status()) && runMatchesQuery(run, query()),
    ),
  );
  const summary = () => {
    const total = allRuns().length;
    const failed = allRuns().filter((run) => run.status === "ERROR").length;
    const parts = [
      `${promptList()?.length ?? 0} prompts`,
      `${total} recent runs`,
      failed > 0 ? `${failed} failed` : total > 0 ? "all succeeded" : null,
    ];
    return parts.filter(Boolean).join(" · ");
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Stack gap="6" maxW="1100px" mx="auto" px={{ base: "3", md: "6" }} pt="5" pb="24">
        <Box px="3">
          {/* Summary reads async data, so it sits in its own boundary to keep SSR and hydration in step. */}
          <Suspense fallback={<SecondaryPageHeader title="AI" />}>
            <SecondaryPageHeader title="AI" summary={summary()} />
          </Suspense>
        </Box>

        <SecondarySection title="Prompts">
          <Suspense fallback={<Text px="3" py="4" fontSize="sm" color="fg.muted">Loading prompts…</Text>}>
            <Show
              when={(promptList()?.length ?? 0) > 0}
              fallback={
                <EmptyState title="No prompts yet">
                  Prompts appear here once you save one from the editor’s AI menu.
                </EmptyState>
              }
            >
              <PromptsTable
                prompts={promptList() ?? []}
                stats={stats()}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            </Show>
          </Suspense>
        </SecondarySection>

        <SecondarySection title="Paid calls">
          <Suspense fallback={<Text px="3" py="4" fontSize="sm" color="fg.muted">Loading paid calls…</Text>}>
            <PaidCallsTable />
          </Suspense>
        </SecondarySection>

        <SecondarySection
          title="Recent runs"
        >
          <Suspense fallback={<Text px="3" py="4" fontSize="sm" color="fg.muted">Loading runs…</Text>}>
            <HStack justify="space-between" gap="2" px="3" pb="2" flexWrap="wrap">
<HStack gap="0.5" role="tablist" aria-label="Run status">
              <For each={RUN_STATUS_FILTERS}>
                {(option) => {
                  const active = () => status() === option.value;
                  return (
                    <Button
                      size="xs"
                      variant="plain"
                      role="tab"
                      aria-selected={active()}
                      bg={active() ? "bg.muted" : "transparent"}
                      color={active() ? "fg.default" : "fg.muted"}
                      _hover={{ color: "fg.default", bg: "bg.muted" }}
                      onClick={() => setParams({ status: option.value === "ALL" ? undefined : option.value }, { replace: true })}
                    >
                      {option.label}
                      <Text as="span" fontSize="xs" color="fg.subtle" fontVariantNumeric="tabular-nums">
                        {statusCounts()[option.value]}
                      </Text>
                    </Button>
                  );
                }}
              </For>
            </HStack>
            <Input
              size="sm"
              w={{ base: "40", md: "60" }}
              placeholder="Filter by task, model, error"
              aria-label="Filter runs"
              value={query()}
              onInput={(event) => setParams({ q: event.currentTarget.value || undefined }, { replace: true })}
              autocomplete="off"
              spellcheck={false}
            />
            </HStack>
            <Show
              when={(runList()?.length ?? 0) > 0}
              fallback={
                <EmptyState title="No runs yet">
                  Run a prompt on a note and its output, model, and status show up here.
                </EmptyState>
              }
            >
              <Show
                when={filteredRuns().length > 0}
                fallback={
                  <EmptyState
                    title="No runs match"
                    action={
                      <Button size="xs" variant="outline" onClick={() => setParams({ q: undefined, status: undefined }, { replace: true })}>
                        Clear filters
                      </Button>
                    }
                  />
                }
              >
                <RunsTable runs={filteredRuns()} />
              </Show>
            </Show>
          </Suspense>
        </SecondarySection>
      </Stack>

      <PromptEditDialog prompt={editing()} onClose={() => setEditing(null)} />
      <PromptDeleteDialog prompt={deleting()} onClose={() => setDeleting(null)} />
    </Box>
  );
};

export default AiDashboard;
