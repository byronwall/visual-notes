import { createAsync, useParams } from "@solidjs/router";
import { type VoidComponent, For, Show, Suspense } from "solid-js";
import { Box, Grid, HStack, Stack, styled } from "styled-system/jsx";
import { RunStatusIcon } from "~/components/ai-dashboard/RunStatusIcon";
import type { RunStatus } from "~/components/ai-dashboard/ai-dashboard-model";
import { KeyValueList, PlainCodeBlock } from "~/components/secondary/DataBlocks";
import { EmptyState } from "~/components/secondary/EmptyState";
import { SecondaryBreadcrumb } from "~/components/secondary/SecondaryBreadcrumb";
import { SecondarySection } from "~/components/secondary/SecondarySection";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import { formatRelativeTimestamp } from "~/features/umap/format";
import { fetchPromptRun } from "~/services/ai/ai-runs.queries";

type PromptRunFull = {
  id: string;
  status: RunStatus;
  model: string;
  createdAt: string;
  error?: string | null;
  compiledPrompt: string;
  systemUsed?: string | null;
  outputHtml?: string | null;
  rawResponse?: unknown | null;
  inputVars?: Record<string, unknown> | null;
  promptVersion?: {
    id: string;
    promptId: string;
    Prompt?: { id: string; task: string; defaultModel: string } | null;
  } | null;
  HumanFeedback?: Array<{
    id: string;
    rating?: number | null;
    comment?: string | null;
    createdAt: string;
  }>;
};

const statusWord: Record<RunStatus, string> = {
  SUCCESS: "Succeeded",
  ERROR: "Failed",
  PARTIAL: "Partial",
};

const RunDetailPage: VoidComponent = () => {
  const params = useParams();
  const run = createAsync(() => {
    if (!params.id) return Promise.resolve<PromptRunFull | null>(null);
    return fetchPromptRun(params.id) as Promise<PromptRunFull | null>;
  });

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Stack gap="6" maxW="1200px" mx="auto" px={{ base: "3", md: "6" }} pt="5" pb="24">
        <Suspense fallback={<Text px="3" fontSize="sm" color="fg.muted">Loading run…</Text>}>
          <Show
            when={run()}
            fallback={
              <Stack gap="3" px="3">
                <SecondaryBreadcrumb items={[{ label: "AI", href: "/ai" }, { label: "Run" }]} />
                <EmptyState title="Run not found">
                  It may have been deleted along with its prompt.
                </EmptyState>
              </Stack>
            }
          >
            {(runItem) => {
              const r = () => runItem();
              const prompt = () => r().promptVersion?.Prompt ?? null;
              const feedback = () => r().HumanFeedback ?? [];
              return (
                <>
                  <Stack gap="2" px="3">
                    <SecondaryBreadcrumb
                      items={[
                        { label: "AI", href: "/ai" },
                        ...(prompt()
                          ? [{ label: prompt()!.task, href: `/ai/prompts/${prompt()!.id}`, mono: true }]
                          : []),
                        { label: `Run ${r().id.slice(0, 8)}`, mono: true },
                      ]}
                    />
                    <HStack gap="2.5" alignItems="center">
                      <RunStatusIcon status={r().status} />
                      <Heading as="h1" fontSize="2xl" fontFamily="mono" fontWeight="semibold">
                        {prompt()?.task ?? "Prompt run"}
                      </Heading>
                    </HStack>
                    <Text fontSize="sm" color="fg.muted">
                      {statusWord[r().status]} · <styled.span fontFamily="mono">{r().model}</styled.span> ·{" "}
                      <time datetime={r().createdAt} title={new Date(r().createdAt).toISOString()}>
                        {formatRelativeTimestamp(r().createdAt)}
                      </time>
                    </Text>
                  </Stack>

                  <Show when={r().error}>
                    {(error) => (
                      <Box mx="3" px="4" py="3" borderRadius="l2" bg="red.subtle.bg" color="red.11" fontSize="sm">
                        <Text fontWeight="semibold" mb="0.5">
                          Error
                        </Text>
                        <Text overflowWrap="anywhere">{error()}</Text>
                      </Box>
                    )}
                  </Show>

                  <Grid gap="8" gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 3fr) minmax(0, 2fr)" }}>
                    <SecondarySection title="Output">
                      <Show
                        when={r().outputHtml}
                        fallback={<EmptyState title="No output">The model returned nothing for this run.</EmptyState>}
                      >
                        {(html) => (
                          <Box
                            px="3"
                            fontSize="sm"
                            lineHeight="1.7"
                            class="ai-html prose"
                            innerHTML={html()}
                          />
                        )}
                      </Show>
                    </SecondarySection>

                    <Stack gap="6">
                      <SecondarySection title="Inputs">
                        <Box px="3">
                          <KeyValueList record={r().inputVars} />
                        </Box>
                      </SecondarySection>
                      <SecondarySection title="Prompt sent">
                        <Box px="3">
                          <PlainCodeBlock maxH="24rem">{r().compiledPrompt}</PlainCodeBlock>
                        </Box>
                      </SecondarySection>
                      <Show when={r().systemUsed}>
                        {(system) => (
                          <SecondarySection title="System">
                            <Box px="3">
                              <PlainCodeBlock>{system()}</PlainCodeBlock>
                            </Box>
                          </SecondarySection>
                        )}
                      </Show>
                      <Show when={r().rawResponse}>
                        <Box px="3">
                          <styled.details>
                            <styled.summary
                              cursor="pointer"
                              fontSize="sm"
                              color="fg.muted"
                              _hover={{ color: "fg.default" }}
                              mb="2"
                            >
                              Raw response
                            </styled.summary>
                            <PlainCodeBlock maxH="28rem">
                              {JSON.stringify(r().rawResponse, null, 2)}
                            </PlainCodeBlock>
                          </styled.details>
                        </Box>
                      </Show>
                    </Stack>
                  </Grid>

                  <Show when={feedback().length > 0}>
                    <SecondarySection title="Feedback" meta={String(feedback().length)}>
                      <Stack gap="2" px="3">
                        <For each={feedback()}>
                          {(item) => (
                            <HStack gap="3" alignItems="baseline" fontSize="sm">
                              <Text fontVariantNumeric="tabular-nums" fontWeight="medium" w="10">
                                {typeof item.rating === "number" ? String(item.rating) : "—"}
                              </Text>
                              <Text flex="1" color={item.comment ? "fg.default" : "fg.subtle"}>
                                {item.comment || "No comment"}
                              </Text>
                              <Text fontSize="xs" color="fg.subtle" whiteSpace="nowrap">
                                {formatRelativeTimestamp(item.createdAt)}
                              </Text>
                            </HStack>
                          )}
                        </For>
                      </Stack>
                    </SecondarySection>
                  </Show>
                </>
              );
            }}
          </Show>
        </Suspense>
      </Stack>
    </Box>
  );
};

export default RunDetailPage;
