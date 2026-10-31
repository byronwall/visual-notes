import { createKeptAsync } from "~/utils/kept-async";
import {
  Clock3Icon,
  EyeIcon,
  FilePlusIcon,
  PencilIcon,
  SearchIcon,
} from "lucide-solid";
import {
  For,
  Show,
  Suspense,
  createSignal,
  type JSX,
  type VoidComponent,
} from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { describeActivityEvent } from "~/components/activity/activity-format";
import { fetchDocActivityHistory } from "~/services/activity/activity.queries";
import type { ActionEventItem } from "~/services/activity/activity.types";
import { Button } from "~/components/ui/button";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";

function formatAbsoluteTimestamp(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function formatRelativeTimestamp(
  anchorIso: string,
  value?: string | null,
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

function eventLabel(event: ActivityEvent): string {
  if (event.eventType === "doc.view") return "Opened";
  if (event.eventType === "doc.update") return "Edited";
  if (event.eventType === "search.result.opened") return "Opened from search";
  return describeActivityEvent(event as ActionEventItem).verb;
}

function eventIcon(eventType: string) {
  if (eventType === "doc.create") return FilePlusIcon;
  if (eventType === "doc.view") return EyeIcon;
  if (eventType === "doc.update") return PencilIcon;
  if (eventType === "search.result.opened") return SearchIcon;
  return Clock3Icon;
}

function EventTypeIcon(props: { eventType: string }) {
  const Icon = eventIcon(props.eventType);
  return <Icon size={12} />;
}

function eventPayloadSummary(
  payload?: Record<string, unknown> | null,
): string | null {
  if (!payload) return null;
  // Only the search query reads as human text; source and size buckets are
  // internal identifiers.
  const value = payload.queryPreview;
  if (typeof value === "string" && value.trim().length > 0)
    return `“${value.trim()}”`;
  return null;
}

type ActivityEvent = {
  eventType: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
};

type ActivityRun = ActivityEvent & { count: number };

/** Collapse back-to-back events of the same kind ("Opened ×4"). */
function groupConsecutive(events: ActivityEvent[]): ActivityRun[] {
  const runs: ActivityRun[] = [];
  for (const event of events) {
    const last = runs[runs.length - 1];
    if (
      last &&
      last.eventType === event.eventType &&
      !eventPayloadSummary(event.payload) &&
      !eventPayloadSummary(last.payload)
    ) {
      last.count += 1;
      continue;
    }
    runs.push({ ...event, count: 1 });
  }
  return runs;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

export const DocActivitySummaryPopover: VoidComponent<{
  docId: string;
  createdAt?: string;
  updatedAt?: string;
  iconOnly?: boolean;
  /**
   * Custom trigger. Rendered while activity loads too, so the anchor never
   * swaps size once the history arrives.
   */
  renderTrigger?: (trigger: {
    onClick: () => void;
    ariaLabel: string;
  }) => JSX.Element;
}> = (props) => {
  const [open, setOpen] = createSignal(false);
  const history = createKeptAsync(() => fetchDocActivityHistory(props.docId));
  const toggle = () => setOpen((value) => !value);

  return (
    <Suspense
      fallback={
        props.renderTrigger ? (
          props.renderTrigger({ onClick: () => {}, ariaLabel: "Activity" })
        ) : (
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
        )
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
              props.renderTrigger ? (
                props.renderTrigger({
                  onClick: toggle,
                  ariaLabel: `Activity: ${data().viewCount} views, ${data().editCount} edits`,
                })
              ) : (
                <Show
                  when={props.iconOnly}
                  fallback={
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      colorPalette="gray"
                      bg="bg.subtle"
                      borderColor="gray.subtle"
                      h="auto"
                      px="2.5"
                      py="1.5"
                      onClick={() => setOpen((value) => !value)}
                    >
                      <HStack gap="2" alignItems="center">
                        <HStack gap="1.5" alignItems="center">
                          <Clock3Icon size={12} />
                          <Text
                            as="span"
                            fontSize="xs"
                            color="fg.default"
                            fontWeight="medium"
                          >
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
                          title={formatAbsoluteTimestamp(props.updatedAt)}
                        >
                          Saved{" "}
                          {formatRelativeTimestamp(
                            data().generatedAt,
                            props.updatedAt,
                          )}
                        </Text>
                      </HStack>
                    </Button>
                  }
                >
                  <Tooltip
                    content="Activity"
                    showArrow
                    portalled={false}
                    contentProps={{ zIndex: "tooltip" }}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      colorPalette="gray"
                      bg="bg.subtle"
                      borderColor="gray.subtle"
                      minW="9"
                      w="9"
                      px="0"
                      aria-label={`Activity: ${data().viewCount} views, ${data().editCount} edits`}
                      onClick={() => setOpen((value) => !value)}
                    >
                      <Clock3Icon size={14} />
                    </Button>
                  </Tooltip>
                </Show>
              )
            }
          >
            <Stack gap="2" p="2.5">
              <Stack gap="0.5" px="2">
                <Text fontSize="sm" fontWeight="semibold" color="fg.default">
                  Activity
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {plural(data().viewCount, "view")} ·{" "}
                  {plural(data().editCount, "edit")} ·{" "}
                  {data().searchOpenedCount} from search
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  <span title={formatAbsoluteTimestamp(props.createdAt)}>
                    Created{" "}
                    {formatRelativeTimestamp(
                      new Date().toISOString(),
                      props.createdAt,
                    )}
                  </span>
                  <Show when={data().lastViewBeforeThisOne}>
                    {" · "}
                    <span
                      title={formatAbsoluteTimestamp(
                        data().lastViewBeforeThisOne,
                      )}
                    >
                      last opened{" "}
                      {formatRelativeTimestamp(
                        new Date().toISOString(),
                        data().lastViewBeforeThisOne,
                      )}
                    </span>
                  </Show>
                </Text>
              </Stack>

              <Box maxH="16rem" overflowY="auto" overflowX="hidden" pr="0.5">
                <Show
                  when={data().events.length > 0}
                  fallback={
                    <Text fontSize="sm" color="fg.muted">
                      No recorded events for this note yet.
                    </Text>
                  }
                >
                  <Stack gap="0">
                    <For each={groupConsecutive(data().events)}>
                      {(event) => (
                        <Box
                          borderRadius="l1"
                          px="2"
                          py="1"
                          _hover={{ bg: "bg.subtle" }}
                        >
                          <HStack
                            justify="space-between"
                            alignItems="baseline"
                            gap="2"
                          >
                            <HStack gap="1.5" alignItems="center">
                              <EventTypeIcon eventType={event.eventType} />
                              <Text
                                fontSize="sm"
                                color="fg.default"
                                fontWeight="medium"
                              >
                                {eventLabel(event)}
                                <Show when={event.count > 1}>
                                  <Box as="span" color="fg.subtle" ml="1">
                                    ×{event.count}
                                  </Box>
                                </Show>
                              </Text>
                            </HStack>
                            <Text
                              fontSize="xs"
                              color="fg.muted"
                              title={formatAbsoluteTimestamp(event.createdAt)}
                            >
                              {formatRelativeTimestamp(
                                new Date().toISOString(),
                                event.createdAt,
                              )}
                            </Text>
                          </HStack>
                          <Show when={eventPayloadSummary(event.payload)}>
                            {(summary) => (
                              <Text
                                fontSize="xs"
                                color="fg.muted"
                                maxW="28rem"
                                truncate
                                pl="5"
                              >
                                {summary()}
                              </Text>
                            )}
                          </Show>
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
