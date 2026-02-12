import { createAsync } from "@solidjs/router";
import { ErrorBoundary, For, Show, Suspense, createMemo, createSignal } from "solid-js";
import { fetchTimelineEvents } from "~/services/activity/activity.queries";
import { Box, Container, Grid, HStack, Stack } from "styled-system/jsx";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { Button } from "~/components/ui/button";
import * as Card from "~/components/ui/card";
import * as Field from "~/components/ui/field";

type TimelineEvent = {
  id: string;
  createdAt: string;
  eventType: string;
  actorId?: string | null;
  actorType: "magic_user" | "anonymous" | "system";
  entityType: string;
  entityId?: string | null;
  relatedDocId?: string | null;
  relatedDocTitle?: string | null;
  relatedDocPath?: string | null;
  payload?: Record<string, unknown> | null;
};

function formatEventTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function toneByDomain(eventType: string) {
  const domain = eventType.split(".")[0] || "other";
  if (domain === "doc") {
    return {
      border: "blue.7",
      bg: "blue.2",
      text: "blue.11",
      label: "Docs",
    };
  }
  if (domain === "search") {
    return {
      border: "green.7",
      bg: "green.2",
      text: "green.11",
      label: "Search",
    };
  }
  if (domain === "ai") {
    return {
      border: "orange.7",
      bg: "orange.2",
      text: "orange.11",
      label: "AI",
    };
  }
  if (domain === "admin") {
    return {
      border: "red.7",
      bg: "red.2",
      text: "red.11",
      label: "Admin",
    };
  }
  return {
    border: "gray.7",
    bg: "gray.2",
    text: "gray.11",
    label: "Other",
  };
}

const MetaRow = (props: { label: string; value: string }) => {
  return (
    <HStack gap="2" alignItems="baseline">
      <Text fontSize="xs" color="fg.muted" minW="4.5rem">
        {props.label}
      </Text>
      <Text
        fontSize="sm"
        color="fg.default"
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
        title={props.value}
      >
        {props.value}
      </Text>
    </HStack>
  );
};

function getPayloadText(
  payload: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!payload) return null;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

const ActivityRoute = () => {
  const [eventType, setEventType] = createSignal("");
  const [entityType, setEntityType] = createSignal("");
  const [actorId, setActorId] = createSignal("");
  const [relatedDocId, setRelatedDocId] = createSignal("");
  const [docPathPrefix, setDocPathPrefix] = createSignal("");
  const [from, setFrom] = createSignal("");
  const [to, setTo] = createSignal("");
  const [take] = createSignal(100);
  const [cursor, setCursor] = createSignal<string | undefined>(undefined);
  const [reloadTick, setReloadTick] = createSignal(0);

  const events = createAsync(() => {
    void reloadTick();
    return fetchTimelineEvents({
      take: take(),
      cursor: cursor(),
      eventType: eventType().trim() || undefined,
      entityType: entityType().trim() || undefined,
      actorId: actorId().trim() || undefined,
      relatedDocId: relatedDocId().trim() || undefined,
      docPathPrefix: docPathPrefix().trim() || undefined,
      from: from().trim() || undefined,
      to: to().trim() || undefined,
    });
  });

  const activeFilterCount = createMemo(() => {
    const filters = [
      eventType().trim(),
      entityType().trim(),
      actorId().trim(),
      relatedDocId().trim(),
      docPathPrefix().trim(),
      from().trim(),
      to().trim(),
    ];
    return filters.filter((value) => Boolean(value)).length;
  });

  const handleApplyFilters = () => {
    setCursor(undefined);
    setReloadTick((value) => value + 1);
  };

  const handleReset = () => {
    setEventType("");
    setEntityType("");
    setActorId("");
    setRelatedDocId("");
    setDocPathPrefix("");
    setFrom("");
    setTo("");
    setCursor(undefined);
    setReloadTick((value) => value + 1);
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container pt="6" pb={{ base: "24", md: "32" }} px="4" maxW="1100px">
        <Stack gap="5">
          <Card.Root
            borderRadius="l3"
            borderWidth="1px"
            borderColor="border"
            bgGradient="to-br"
            gradientFrom="bg.default"
            gradientTo="gray.2"
          >
            <Card.Body>
              <Stack gap="3">
                <HStack justify="space-between" alignItems="center" flexWrap="wrap" gap="3">
                  <Heading as="h1" fontSize={{ base: "2xl", md: "3xl" }}>
                    Activity
                  </Heading>
                  <HStack gap="2">
                    <Box
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="full"
                      px="3"
                      py="1"
                      bg="bg.default"
                    >
                      <Text fontSize="xs" color="fg.muted">
                        Active filters: {activeFilterCount()}
                      </Text>
                    </Box>
                    <Box
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="full"
                      px="3"
                      py="1"
                      bg="bg.default"
                    >
                      <Text fontSize="xs" color="fg.muted">
                        Showing up to {take()} events
                      </Text>
                    </Box>
                  </HStack>
                </HStack>
                <Text color="fg.muted" maxW="70ch">
                  Timeline of major app actions with links back to related notes and entities.
                </Text>
              </Stack>
            </Card.Body>
          </Card.Root>

          <Card.Root borderWidth="1px" borderColor="border" borderRadius="l3">
            <Card.Header>
              <Stack gap="1">
                <Card.Title>Filters</Card.Title>
                <Card.Description>
                  Narrow events by source, actor, entity, related notes, and time window.
                </Card.Description>
              </Stack>
            </Card.Header>
            <Card.Body>
              <Stack gap="4">
                <Grid
                  gridTemplateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }}
                  gap="3"
                >
                  <Field.Root>
                    <Field.Label>Event type</Field.Label>
                    <Input
                      placeholder="doc.update"
                      value={eventType()}
                      onInput={(event) => setEventType(event.currentTarget.value)}
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Entity type</Field.Label>
                    <Input
                      placeholder="doc"
                      value={entityType()}
                      onInput={(event) => setEntityType(event.currentTarget.value)}
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Actor</Field.Label>
                    <Input
                      placeholder="magic_..."
                      value={actorId()}
                      onInput={(event) => setActorId(event.currentTarget.value)}
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Related doc ID</Field.Label>
                    <Input
                      placeholder="cm..."
                      value={relatedDocId()}
                      onInput={(event) => setRelatedDocId(event.currentTarget.value)}
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Doc path prefix</Field.Label>
                    <Input
                      placeholder="work.projects"
                      value={docPathPrefix()}
                      onInput={(event) => setDocPathPrefix(event.currentTarget.value)}
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>From (UTC)</Field.Label>
                    <Input
                      type="datetime-local"
                      value={from()}
                      onInput={(event) => setFrom(event.currentTarget.value)}
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>To (UTC)</Field.Label>
                    <Input
                      type="datetime-local"
                      value={to()}
                      onInput={(event) => setTo(event.currentTarget.value)}
                    />
                  </Field.Root>
                </Grid>

                <HStack gap="2" alignItems="center">
                  <Button size="sm" onClick={handleApplyFilters}>
                    Apply filters
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    Reset
                  </Button>
                </HStack>
              </Stack>
            </Card.Body>
          </Card.Root>

          <ErrorBoundary fallback={<Text color="red.11">Failed to load activity.</Text>}>
            <Suspense fallback={<Text color="fg.muted">Loading activity…</Text>}>
              <Show
                when={(events()?.length ?? 0) > 0}
                fallback={
                  <Card.Root borderWidth="1px" borderColor="border" borderRadius="l3">
                    <Card.Body>
                      <Text color="fg.muted">No activity events found.</Text>
                    </Card.Body>
                  </Card.Root>
                }
              >
                <Stack gap="3">
                  <For each={events() as TimelineEvent[]}>
                    {(event) => {
                      const tone = toneByDomain(event.eventType);
                      const queryText = getPayloadText(event.payload, [
                        "queryPreview",
                        "queryText",
                        "searchText",
                      ]);
                      const docTitle =
                        event.relatedDocTitle ||
                        getPayloadText(event.payload, ["docTitle", "title"]);
                      return (
                        <Box
                          borderWidth="1px"
                          borderColor="border"
                          borderLeftWidth="4px"
                          borderLeftColor={tone.border}
                          borderRadius="l2"
                          px="4"
                          py="3"
                          bg="bg.default"
                          transition="background 120ms ease"
                          _hover={{ bg: "bg.subtle" }}
                        >
                          <Stack gap="3">
                            <HStack justify="space-between" alignItems="flex-start" gap="3" flexWrap="wrap">
                              <HStack gap="2" flexWrap="wrap">
                                <Box
                                  px="2"
                                  py="0.5"
                                  borderRadius="full"
                                  fontSize="xs"
                                  fontWeight="medium"
                                  bg={tone.bg}
                                  color={tone.text}
                                >
                                  {tone.label}
                                </Box>
                                <Box
                                  px="2"
                                  py="0.5"
                                  borderRadius="full"
                                  fontSize="xs"
                                  borderWidth="1px"
                                  borderColor="border"
                                  color="fg.muted"
                                >
                                  {event.actorType}
                                </Box>
                                <Text fontSize="sm" fontWeight="semibold">
                                  {event.eventType}
                                </Text>
                              </HStack>

                              <HStack gap="3" alignItems="center" flexWrap="wrap">
                                <Text fontSize="xs" color="fg.muted">
                                  {formatEventTime(event.createdAt)}
                                </Text>
                                <Show when={event.relatedDocId}>
                                  {(docId) => (
                                    <Link href={`/docs/${docId()}`} fontSize="xs">
                                      Open note
                                    </Link>
                                  )}
                                </Show>
                                <Show when={event.entityType === "prompt_run" && event.entityId}>
                                  {(entityId) => (
                                    <Link href={`/ai/runs/${entityId()}`} fontSize="xs">
                                      Open run
                                    </Link>
                                  )}
                                </Show>
                              </HStack>
                            </HStack>

                            <Grid
                              gridTemplateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }}
                              gap="2"
                            >
                              <Show when={docTitle}>
                                {(value) => <MetaRow label="note" value={value()} />}
                              </Show>
                              <Show when={queryText}>
                                {(value) => <MetaRow label="query" value={value()} />}
                              </Show>
                              <MetaRow
                                label="actor"
                                value={
                                  event.actorId
                                    ? `${event.actorType} (${event.actorId})`
                                    : event.actorType
                                }
                              />
                              <MetaRow
                                label="entity"
                                value={
                                  event.entityId
                                    ? `${event.entityType} (${event.entityId})`
                                    : event.entityType
                                }
                              />
                              <Show when={event.relatedDocPath}>
                                {(value) => <MetaRow label="path" value={value()} />}
                              </Show>
                            </Grid>

                            <Show when={event.payload && Object.keys(event.payload).length > 0}>
                              {(payload) => (
                                <HStack gap="1.5" flexWrap="wrap">
                                  <For
                                    each={Object.entries(payload()).filter(
                                      ([key]) =>
                                        key !== "docTitle" &&
                                        key !== "title" &&
                                        key !== "queryPreview" &&
                                        key !== "queryText" &&
                                        key !== "searchText"
                                    )}
                                  >
                                    {([key, value]) => (
                                      <Box
                                        borderWidth="1px"
                                        borderColor="border"
                                        borderRadius="full"
                                        px="2.5"
                                        py="1"
                                        fontSize="xs"
                                        color="fg.muted"
                                        bg="bg.subtle"
                                      >
                                        {key}: {String(value)}
                                      </Box>
                                    )}
                                  </For>
                                </HStack>
                              )}
                            </Show>
                          </Stack>
                        </Box>
                      );
                    }}
                  </For>

                  <Button
                    size="sm"
                    variant="outline"
                    alignSelf="flex-start"
                    onClick={() => {
                      const list = events() || [];
                      const last = list[list.length - 1];
                      if (!last) return;
                      setCursor(last.id);
                      setReloadTick((value) => value + 1);
                    }}
                  >
                    Load older
                  </Button>
                </Stack>
              </Show>
            </Suspense>
          </ErrorBoundary>
        </Stack>
      </Container>
    </Box>
  );
};

export default ActivityRoute;
