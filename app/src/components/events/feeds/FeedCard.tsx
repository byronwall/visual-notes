import { useAction } from "@solidjs/router";
import { Box, Grid, Stack } from "styled-system/jsx";
import type { FeedPatch } from "~/lib/events/feed-schemas";
import type { CalendarFeed } from "~/lib/events/types";
import { saveCalendarFeed } from "~/services/events/feeds.actions";
import type { FeedRuleOption } from "~/services/events/feeds.queries";
import { FeedHeader } from "./FeedHeader";
import { FeedManualEntries } from "./FeedManualEntries";
import { FeedPreviewList } from "./FeedPreviewList";
import { FeedRuleEditor } from "./FeedRuleEditor";
import { FeedSubscribeUrl } from "./FeedSubscribeUrl";
import { useFeedsRefresh } from "./feedsRefresh";

export type FeedSave = (patch: FeedPatch) => Promise<void>;

/** One feed: name, rule, subscribe URL, preview, and manual entries. */
export function FeedCard(props: {
  feed: CalendarFeed;
  ruleOptions: FeedRuleOption[];
  origin: string;
}) {
  const refresh = useFeedsRefresh();
  const runSave = useAction(saveCalendarFeed);
  const save: FeedSave = async (patch) => {
    await runSave({ id: props.feed.id, patch });
    refresh.bump();
  };

  return (
    <Box
      as="section"
      aria-label={props.feed.name}
      borderWidth="1px"
      borderColor="border"
      borderRadius="l3"
      bg="bg.default"
      overflow="hidden"
    >
      <FeedHeader feed={props.feed} onSave={save} />
      <Grid
        gridTemplateColumns={{
          base: "minmax(0, 1fr)",
          lg: "minmax(0, 5fr) minmax(0, 6fr)",
        }}
        gap="0"
      >
        <Stack
          gap="6"
          p={{ base: "4", md: "5" }}
          borderRightWidth={{ base: "0", lg: "1px" }}
          borderBottomWidth={{ base: "1px", lg: "0" }}
          borderColor="border"
        >
          <FeedRuleEditor
            feed={props.feed}
            options={props.ruleOptions}
            onSave={save}
          />
          <FeedManualEntries feed={props.feed} />
        </Stack>
        <Stack gap="6" p={{ base: "4", md: "5" }} minW="0">
          <FeedSubscribeUrl feed={props.feed} origin={props.origin} />
          <FeedPreviewList feed={props.feed} />
        </Stack>
      </Grid>
    </Box>
  );
}
