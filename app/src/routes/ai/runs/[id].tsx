import {
  type VoidComponent,
  For,
  Show,
  Suspense,
} from "solid-js";
import { A, createAsync, useParams } from "@solidjs/router";
import { Badge } from "~/components/ui/badge";
import * as Card from "~/components/ui/card";
import { Heading } from "~/components/ui/heading";
import { Spinner } from "~/components/ui/spinner";
import { Text } from "~/components/ui/text";
import {
  Box,
  Container,
  Flex,
  Grid,
  HStack,
  Spacer,
  Stack,
} from "styled-system/jsx";
import { styled } from "styled-system/jsx";
import { link } from "styled-system/recipes";
import { fetchPromptRun } from "~/services/ai/ai-runs.queries";

type RunStatus = "SUCCESS" | "ERROR" | "PARTIAL";

type PromptRunFull = {
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

const statusColorPalette = (status: RunStatus) => {
  if (status === "SUCCESS") return "green";
  if (status === "ERROR") return "red";
  return "gray";
};

const RouterLink = styled(A, link);

const RunDetailPage: VoidComponent = () => {
  const params = useParams();
  const run = createAsync(() => {
    if (!params.id) return Promise.resolve<PromptRunFull | null>(null);
    return fetchPromptRun(params.id) as Promise<PromptRunFull | null>;
  });

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
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="6" px="4" maxW="1200px">
        <Stack gap="6">
          <Box>
            <RouterLink href="/ai">← Back to AI Dashboard</RouterLink>
          </Box>

          <Suspense fallback={<LoadingInline label="Loading run…" />}>
            <Show when={run()}>
              {(runItem) => {
                const r = () => runItem();
                const feedbackItems = () => r().HumanFeedback ?? [];

                return (
                  <Stack gap="6">
                    <Flex
                      align="center"
                      justify="space-between"
                      gap="3"
                      flexWrap="wrap"
                    >
                      <Stack gap="1">
                        <Heading as="h1" fontSize="2xl">
                          Run{" "}
                          <Text as="span" fontFamily="mono" color="fg.default">
                            {r().id.slice(0, 8)}
                          </Text>
                        </Heading>
                        <HStack gap="2" flexWrap="wrap" alignItems="center">
                          <Text textStyle="sm" color="fg.muted">
                            {new Date(r().createdAt).toLocaleString()} ·{" "}
                            <Text as="span" color="fg.default">
                              {r().model}
                            </Text>
                          </Text>
                          <Badge
                            size="sm"
                            variant="subtle"
                            colorPalette={statusColorPalette(r().status)}
                          >
                            {r().status}
                          </Badge>
                        </HStack>
                      </Stack>

                      <Show when={r().promptVersion?.Prompt}>
                        {(p) => (
                          <RouterLink href={`/ai/prompts/${p().id}`}>
                            View Prompt:{" "}
                            <Text as="span" fontWeight="semibold">
                              {p().task}
                            </Text>
                          </RouterLink>
                        )}
                      </Show>
                    </Flex>

                    <Grid
                      gap="6"
                      gridTemplateColumns={{
                        base: "1fr",
                        lg: "repeat(2, minmax(0, 1fr))",
                      }}
                    >
                      <Stack gap="4">
                        <Card.Root>
                          <Card.Header>
                            <HStack>
                              <Text textStyle="sm" fontWeight="semibold">
                                Compiled Prompt
                              </Text>
                              <Spacer />
                            </HStack>
                          </Card.Header>
                          <Card.Body>
                            <Box
                              as="pre"
                              fontFamily="mono"
                              fontSize="xs"
                              bg="bg.subtle"
                              borderWidth="1px"
                              borderColor="border"
                              borderRadius="l2"
                              p="3"
                              whiteSpace="pre-wrap"
                            >
                              {r().compiledPrompt}
                            </Box>
                          </Card.Body>
                        </Card.Root>

                        <Show when={r().systemUsed}>
                          {(s) => (
                            <Card.Root>
                              <Card.Header>
                                <HStack>
                                  <Text textStyle="sm" fontWeight="semibold">
                                    System
                                  </Text>
                                  <Spacer />
                                </HStack>
                              </Card.Header>
                              <Card.Body>
                                <Box
                                  as="pre"
                                  fontFamily="mono"
                                  fontSize="xs"
                                  bg="bg.subtle"
                                  borderWidth="1px"
                                  borderColor="border"
                                  borderRadius="l2"
                                  p="3"
                                  whiteSpace="pre-wrap"
                                >
                                  {s()}
                                </Box>
                              </Card.Body>
                            </Card.Root>
                          )}
                        </Show>

                        <Card.Root>
                          <Card.Header>
                            <HStack>
                              <Text textStyle="sm" fontWeight="semibold">
                                Input Vars
                              </Text>
                              <Spacer />
                            </HStack>
                          </Card.Header>
                          <Card.Body>
                            <Box
                              as="pre"
                              fontFamily="mono"
                              fontSize="xs"
                              bg="bg.subtle"
                              borderWidth="1px"
                              borderColor="border"
                              borderRadius="l2"
                              p="3"
                              whiteSpace="pre-wrap"
                            >
                              {JSON.stringify(r().inputVars ?? {}, null, 2)}
                            </Box>
                          </Card.Body>
                        </Card.Root>
                      </Stack>

                      <Stack gap="4">
                        <Card.Root>
                          <Card.Header>
                            <HStack>
                              <Text textStyle="sm" fontWeight="semibold">
                                Output (HTML)
                              </Text>
                              <Spacer />
                            </HStack>
                          </Card.Header>
                          <Card.Body>
                            <Box
                              fontSize="xs"
                              bg="bg.subtle"
                              borderWidth="1px"
                              borderColor="border"
                              borderRadius="l2"
                              p="3"
                              whiteSpace="pre-wrap"
                            >
                              <Show
                                when={r().outputHtml}
                                fallback={<Text as="span">—</Text>}
                              >
                                {(h) => <Box innerHTML={h()} />}
                              </Show>
                            </Box>
                          </Card.Body>
                        </Card.Root>

                        <Card.Root>
                          <Card.Header>
                            <HStack>
                              <Text textStyle="sm" fontWeight="semibold">
                                Raw Response
                              </Text>
                              <Spacer />
                            </HStack>
                          </Card.Header>
                          <Card.Body>
                            <Box
                              as="pre"
                              fontFamily="mono"
                              fontSize="xs"
                              bg="bg.subtle"
                              borderWidth="1px"
                              borderColor="border"
                              borderRadius="l2"
                              p="3"
                              whiteSpace="pre-wrap"
                            >
                              {JSON.stringify(r().rawResponse ?? {}, null, 2)}
                            </Box>
                          </Card.Body>
                        </Card.Root>

                        <Show when={r().error}>
                          {(e) => (
                            <Card.Root>
                              <Card.Header>
                                <HStack>
                                  <Text textStyle="sm" fontWeight="semibold">
                                    Error
                                  </Text>
                                  <Spacer />
                                </HStack>
                              </Card.Header>
                              <Card.Body>
                                <Text as="div" textStyle="sm" color="error">
                                  {e()}
                                </Text>
                              </Card.Body>
                            </Card.Root>
                          )}
                        </Show>
                      </Stack>
                    </Grid>

                    <Show when={feedbackItems().length > 0}>
                      <Card.Root>
                        <Card.Header>
                          <HStack>
                            <Text textStyle="sm" fontWeight="semibold">
                              Human Feedback
                            </Text>
                            <Spacer />
                            <Text textStyle="xs" color="fg.muted">
                              {feedbackItems().length}
                            </Text>
                          </HStack>
                        </Card.Header>
                        <Card.Body>
                          <Stack gap="3">
                            <For each={feedbackItems()}>
                              {(f) => (
                                <Box
                                  borderWidth="1px"
                                  borderColor="border"
                                  borderRadius="l2"
                                  p="3"
                                >
                                  <Stack gap="1">
                                    <HStack gap="2">
                                      <Text
                                        as="span"
                                        textStyle="sm"
                                        color="fg.muted"
                                      >
                                        Rating:
                                      </Text>
                                      <Text
                                        as="span"
                                        textStyle="sm"
                                        color="fg.default"
                                      >
                                        {typeof f.rating === "number"
                                          ? f.rating
                                          : "—"}
                                      </Text>
                                    </HStack>
                                    <HStack gap="2" alignItems="flex-start">
                                      <Text
                                        as="span"
                                        textStyle="sm"
                                        color="fg.muted"
                                      >
                                        Comment:
                                      </Text>
                                      <Text
                                        as="span"
                                        textStyle="sm"
                                        color="fg.default"
                                      >
                                        {f.comment || "—"}
                                      </Text>
                                    </HStack>
                                    <Text
                                      as="div"
                                      textStyle="xs"
                                      color="fg.muted"
                                    >
                                      {new Date(f.createdAt).toLocaleString()}
                                    </Text>
                                  </Stack>
                                </Box>
                              )}
                            </For>
                          </Stack>
                        </Card.Body>
                      </Card.Root>
                    </Show>
                  </Stack>
                );
              }}
            </Show>
          </Suspense>
        </Stack>
      </Container>
    </Box>
  );
};

export default RunDetailPage;
