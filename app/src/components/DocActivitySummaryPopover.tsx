import { createAsync } from "@solidjs/router";
import { Clock3Icon, EyeIcon, PencilIcon, SearchIcon } from "lucide-solid";
import { For, Show, Suspense, createSignal, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { fetchDocActivityHistory } from "~/services/activity/activity.queries";
import { Button } from "~/components/ui/button";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";

function formatAbsoluteTimestamp(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function formatRelativeTimestamp(
  anchorIso: string,
  value?: string | null
): string {
  if (!value) return "-";
  const anchor = new Date(anchorIso).getTime();
  const target = new Date(value).getTime();
  if (Number.isNaN(anchor) || Number.isNaN(target)) return value;
  const seconds = Math.max(0, Math.floor((anchor - target) / 1000));
  if (seconds < 15) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function eventTypeLabel(eventType: string): string {
  if (eventType === "doc.view") return "Opened";
  if (eventType === "doc.update") return "Edited";
  if (eventType === "search.result.opened") return "Opened from search";
  return eventType;
}

function eventIcon(eventType: string) {
  if (eventType === "doc.view") return EyeIcon;
  if (eventType === "doc.update") return PencilIcon;
  if (eventType === "search.result.opened") return SearchIcon;
  return Clock3Icon;
}

function EventTypeIcon(props: { eventType: string }) {
  const Icon = eventIcon(props.eventType);
  return <Icon size={12} />;
}

function eventPayloadSummary(payload?: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const keys = ["docTitle", "queryPreview", "source", "lengthDeltaBucket"];
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

export const DocActivitySummaryPopover: VoidComponent<{
  docId: string;
  createdAt?: string;
  updatedAt?: string;
}> = (props) => {
  const [open, setOpen] = createSignal(false);
  const history = createAsync(() => fetchDocActivityHistory(props.docId));

  return (
    <Suspense
      fallback={
        <Box
          borderWidth="1px"
          borderColor="gray.outline.border"
          borderRadius="l2"
          px="3"
          py="2"
        >
          <Text fontSize="xs" color="fg.muted">
            Loading activity...
          </Text>
        </Box>
      }
    >
      <Show when={history()}>
        {(data) => (
          <SimplePopover
            open={open()}
            onClose={() => setOpen(false)}
            placement="bottom-start"
            offset={8}
            style={{ width: "min(24rem, 86vw)" }}
            anchor={
              <Button
                type="button"
                size="xs"
                variant="outline"
                colorPalette="gray"
                bg="bg.default"
                borderColor="border"
                h="auto"
                px="2"
                py="1.5"
                onClick={() => setOpen((value) => !value)}
              >
                <HStack gap="2" alignItems="center" flexWrap="wrap">
                  <HStack gap="1" alignItems="center">
                    <Clock3Icon size={12} />
                    <Text as="span" fontSize="xs" color="fg.default" fontWeight="medium">
                      Activity
                    </Text>
                  </HStack>
                  <HStack gap="1" alignItems="center">
                    <EyeIcon size={12} />
                    <Text as="span" fontSize="xs" color="fg.muted">
                      {data().viewCount}
                    </Text>
                  </HStack>
                  <HStack gap="1" alignItems="center">
                    <PencilIcon size={12} />
                    <Text as="span" fontSize="xs" color="fg.muted">
                      {data().editCount}
                    </Text>
                  </HStack>
                  <Text
                    as="span"
                    fontSize="xs"
                    color="fg.muted"
                    title={formatAbsoluteTimestamp(data().lastViewBeforeThisOne)}
                  >
                    Prev view {formatRelativeTimestamp(data().generatedAt, data().lastViewBeforeThisOne)}
                  </Text>
                  <Text
                    as="span"
                    fontSize="xs"
                    color="fg.muted"
                    title={formatAbsoluteTimestamp(props.createdAt)}
                  >
                    Created {formatRelativeTimestamp(data().generatedAt, props.createdAt)}
                  </Text>
                  <Text
                    as="span"
                    fontSize="xs"
                    color="fg.muted"
                    title={formatAbsoluteTimestamp(props.updatedAt)}
                  >
                    Saved {formatRelativeTimestamp(data().generatedAt, props.updatedAt)}
                  </Text>
                </HStack>
              </Button>
            }
          >
            <Stack gap="2" p="2.5">
              <HStack gap="2" alignItems="center" flexWrap="wrap">
                <Text fontSize="sm" fontWeight="semibold" color="fg.default">
                  Activity
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  Events {data().events.length}
                </Text>
                <HStack gap="1" alignItems="center">
                  <EyeIcon size={12} />
                  <Text fontSize="xs" color="fg.muted">
                    {data().viewCount}
                  </Text>
                </HStack>
                <HStack gap="1" alignItems="center">
                  <PencilIcon size={12} />
                  <Text fontSize="xs" color="fg.muted">
                    {data().editCount}
                  </Text>
                </HStack>
                <HStack gap="1" alignItems="center">
                  <SearchIcon size={12} />
                  <Text fontSize="xs" color="fg.muted">
                    {data().searchOpenedCount}
                  </Text>
                </HStack>
              </HStack>

              <HStack gap="3" flexWrap="wrap">
                <Text
                  fontSize="xs"
                  color="fg.muted"
                  title={formatAbsoluteTimestamp(data().lastViewBeforeThisOne)}
                >
                  Prev view {formatRelativeTimestamp(data().generatedAt, data().lastViewBeforeThisOne)}
                </Text>
                <Text
                  fontSize="xs"
                  color="fg.muted"
                  title={formatAbsoluteTimestamp(props.createdAt)}
                >
                  Created {formatRelativeTimestamp(data().generatedAt, props.createdAt)}
                </Text>
                <Text
                  fontSize="xs"
                  color="fg.muted"
                  title={formatAbsoluteTimestamp(props.updatedAt)}
                >
                  Saved {formatRelativeTimestamp(data().generatedAt, props.updatedAt)}
                </Text>
              </HStack>

              <Box borderTopWidth="1px" borderColor="border" />

              <Box maxH="16rem" overflowY="auto" overflowX="hidden" pr="0.5">
                <Show
                  when={data().events.length > 0}
                  fallback={
                    <Text fontSize="sm" color="fg.muted">
                      No recorded events for this note yet.
                    </Text>
                  }
                >
                  <Stack gap="1.5">
                    <For each={data().events}>
                      {(event) => (
                        <Box borderWidth="1px" borderColor="border" borderRadius="l1" px="2" py="1.5">
                          <HStack justify="space-between" alignItems="baseline" gap="2">
                            <HStack gap="1.5" alignItems="center">
                              <EventTypeIcon eventType={event.eventType} />
                              <Text fontSize="sm" color="fg.default" fontWeight="medium">
                                {eventTypeLabel(event.eventType)}
                              </Text>
                            </HStack>
                            <Text
                              fontSize="xs"
                              color="fg.muted"
                              title={formatAbsoluteTimestamp(event.createdAt)}
                            >
                              {formatRelativeTimestamp(data().generatedAt, event.createdAt)}
                            </Text>
                          </HStack>
                          <HStack gap="1.5" mt="0.5" flexWrap="wrap">
                            <Text fontSize="xs" color="fg.muted">
                              {event.eventType}
                            </Text>
                            <Show when={event.actorType}>
                              <Text fontSize="xs" color="fg.muted">
                                {event.actorType}
                              </Text>
                            </Show>
                            <Show when={eventPayloadSummary(event.payload)}>
                              {(summary) => (
                                <Text fontSize="xs" color="fg.muted" maxW="28rem" truncate>
                                  {summary()}
                                </Text>
                              )}
                            </Show>
                          </HStack>
                        </Box>
                      )}
                    </For>
                  </Stack>
                </Show>
              </Box>
            </Stack>
          </SimplePopover>
        )}
      </Show>
    </Suspense>
  );
};
