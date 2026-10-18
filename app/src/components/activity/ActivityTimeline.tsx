import { For, createMemo } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import type { ActionEventItem } from "~/services/activity/activity.types";
import { ActivityEventRow } from "./ActivityEventRow";
import {
  clockTimeFor,
  collapseRepeats,
  groupByDay,
  relativeLabelFor,
} from "./activity-format";

type ActivityTimelineProps = {
  events: ActionEventItem[];
  timeZone: string;
  nowMs: number;
};

const fullTimestamp = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));

export const ActivityTimeline = (props: ActivityTimelineProps) => {
  const groups = createMemo(() =>
    groupByDay(props.events, props.timeZone, props.nowMs).map((group) => ({
      ...group,
      rows: collapseRepeats(group.events),
    })),
  );

  return (
    <Stack gap="5">
      <For each={groups()}>
        {(group) => (
          <Box role="group" aria-label={group.label}>
            <Box
              position="sticky"
              top="0"
              zIndex="1"
              bg="bg.default"
              px="3"
              py="1.5"
              display="flex"
              alignItems="baseline"
              gap="2"
            >
              <Text fontSize="sm" fontWeight="semibold" color="fg.default">
                {group.label}
              </Text>
              <Text fontSize="xs" color="fg.subtle">
                {group.events.length}
              </Text>
            </Box>
            <Stack gap="0">
              <For each={group.rows}>
                {(row) => (
                  <ActivityEventRow
                    event={row.event}
                    count={row.count}
                    timeLabel={
                      group.label === "Today"
                        ? relativeLabelFor(row.event.createdAt, props.nowMs)
                        : clockTimeFor(row.event.createdAt, props.timeZone)
                    }
                    timeTitle={fullTimestamp(row.event.createdAt, props.timeZone)}
                  />
                )}
              </For>
            </Stack>
          </Box>
        )}
      </For>
    </Stack>
  );
};
