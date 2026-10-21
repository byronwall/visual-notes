import { createEffect, createMemo, createSignal, untrack } from "solid-js";
import { css } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Text } from "~/components/ui/text";
import type { CalendarFeed } from "~/lib/events/types";
import type { FeedRuleOption } from "~/services/events/feeds.queries";
import { DecisionChecks } from "./DecisionChecks";
import type { FeedSave } from "./FeedCard";
import { FeedSection } from "./FeedSection";
import { describeRule } from "./describeRule";

const NONE = "__none";
const ALL_ROWS = "__all";

/** Collection → view → decisions → past days. Each change saves at once. */
export function FeedRuleEditor(props: {
  feed: CalendarFeed;
  options: FeedRuleOption[];
  onSave: FeedSave;
}) {
  const collection = createMemo(() =>
    props.options.find((c) => c.id === props.feed.collectionId),
  );
  const collectionItems = createMemo(() => [
    { label: "No collection", value: NONE },
    ...props.options.map((c) => ({ label: c.name, value: c.id })),
  ]);
  const viewItems = createMemo(() => [
    { label: "Every row", value: ALL_ROWS },
    ...(collection()?.views ?? []).map((v) => ({ label: v.name, value: v.id })),
  ]);

  const [pastDays, setPastDays] = createSignal(
    untrack(() => String(props.feed.pastDays)),
  );
  createEffect(() => setPastDays(String(props.feed.pastDays)));
  const commitPastDays = () => {
    const n = Math.round(Number(pastDays()));
    if (!Number.isFinite(n) || n < 0 || n > 3650)
      return setPastDays(String(props.feed.pastDays));
    if (n !== props.feed.pastDays) void props.onSave({ pastDays: n });
  };

  return (
    <FeedSection title="Rule">
      <Text fontSize="sm" color="fg.muted" mt="-1">
        {describeRule(props.feed, collection())}
      </Text>
      <Stack gap="3">
        <HStack gap="3" flexWrap="wrap" alignItems="flex-end">
          <Stack gap="1" flex="1 1 12rem" minW="0">
            <SimpleSelect
              label="Collection"
              labelProps={{ fontSize: "xs", fontWeight: "medium" }}
              size="sm"
              items={collectionItems()}
              value={props.feed.collectionId ?? NONE}
              skipPortal={false}
              onChange={(value) => {
                const next = value && value !== NONE ? value : null;
                if (next !== props.feed.collectionId)
                  void props.onSave({ collectionId: next });
              }}
            />
          </Stack>
          <Stack gap="1" flex="1 1 12rem" minW="0">
            <SimpleSelect
              label="Only rows in view"
              labelProps={{ fontSize: "xs", fontWeight: "medium" }}
              size="sm"
              items={viewItems()}
              value={props.feed.viewId ?? ALL_ROWS}
              skipPortal={false}
              onChange={(value) => {
                const next = value && value !== ALL_ROWS ? value : null;
                if (next !== props.feed.viewId)
                  void props.onSave({ viewId: next });
              }}
            />
          </Stack>
        </HStack>
        <Stack gap="1.5">
          <Text fontSize="xs" fontWeight="medium">
            Decisions{" "}
            <Text as="span" color="fg.subtle" fontWeight="normal">
              (none checked = any)
            </Text>
          </Text>
          <DecisionChecks
            value={props.feed.decisions}
            onChange={(decisions) => void props.onSave({ decisions })}
          />
        </Stack>
        <HStack gap="2" alignItems="center">
          <label
            for={`past-${props.feed.id}`}
            class={css({ fontSize: "xs", fontWeight: "medium" })}
          >
            Keep past shows for
          </label>
          <Input
            id={`past-${props.feed.id}`}
            size="xs"
            type="number"
            min="0"
            max="3650"
            w="20"
            value={pastDays()}
            onInput={(e) => setPastDays(e.currentTarget.value)}
            onBlur={commitPastDays}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <Text fontSize="xs" color="fg.muted">
            days
          </Text>
        </HStack>
      </Stack>
    </FeedSection>
  );
}
