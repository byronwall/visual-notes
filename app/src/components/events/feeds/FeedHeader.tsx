import { useAction } from "@solidjs/router";
import { RefreshCwIcon, Trash2Icon } from "lucide-solid";
import { createEffect, createSignal, untrack } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Input } from "~/components/ui/input";
import type { CalendarFeed } from "~/lib/events/types";
import {
  removeCalendarFeed,
  rotateCalendarFeedToken,
} from "~/services/events/feeds.actions";
import type { FeedSave } from "./FeedCard";
import { useFeedsRefresh } from "./feedsRefresh";

const inlineInput = {
  variant: "flushed",
  px: "0",
  borderColor: "transparent",
  _hover: { borderColor: "border" },
  _focus: { borderColor: "colorPalette.solid.bg" },
} as const;

/** Inline-editable name and description, plus rotate and delete. */
export function FeedHeader(props: { feed: CalendarFeed; onSave: FeedSave }) {
  const refresh = useFeedsRefresh();
  const runRotate = useAction(rotateCalendarFeedToken);
  const runRemove = useAction(removeCalendarFeed);
  const [name, setName] = createSignal(untrack(() => props.feed.name));
  const [description, setDescription] = createSignal(
    untrack(() => props.feed.description ?? ""),
  );
  const [confirm, setConfirm] = createSignal<"rotate" | "delete" | null>(null);

  createEffect(() => setName(props.feed.name));
  createEffect(() => setDescription(props.feed.description ?? ""));

  const commitName = () => {
    const next = name().trim();
    if (!next) return setName(props.feed.name);
    if (next !== props.feed.name) void props.onSave({ name: next });
  };
  const commitDescription = () => {
    const next = description().trim();
    if (next !== (props.feed.description ?? ""))
      void props.onSave({ description: next || null });
  };
  const blurOnEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
  };

  return (
    <HStack
      gap="4"
      p={{ base: "4", md: "5" }}
      pb="4"
      borderBottomWidth="1px"
      borderColor="border"
      bg="bg.subtle"
      alignItems="flex-start"
      flexWrap="wrap"
    >
      <Stack gap="0.5" flex="1 1 18rem" minW="0">
        <Input
          {...inlineInput}
          size="md"
          fontSize="lg"
          fontWeight="semibold"
          aria-label="Feed name"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          onBlur={commitName}
          onKeyDown={blurOnEnter}
        />
        <Input
          {...inlineInput}
          size="sm"
          color="fg.muted"
          placeholder="Add a description for subscribers"
          aria-label="Feed description"
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
          onBlur={commitDescription}
          onKeyDown={blurOnEnter}
        />
      </Stack>
      <HStack gap="2" flexShrink="0">
        <Button
          size="xs"
          variant="outline"
          onClick={() => setConfirm("rotate")}
        >
          <RefreshCwIcon />
          New URL
        </Button>
        <Button
          size="xs"
          variant="outline"
          colorPalette="red"
          onClick={() => setConfirm("delete")}
        >
          <Trash2Icon />
          Delete
        </Button>
      </HStack>

      <ConfirmDialog
        open={confirm() === "rotate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Replace the subscribe URL?"
        description="Calendars subscribed to the current URL stop updating. Share the new URL with anyone who should keep the feed."
        confirmLabel="Replace URL"
        onConfirm={() => void runRotate(props.feed.id).then(refresh.bump)}
      />
      <ConfirmDialog
        open={confirm() === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Delete “${props.feed.name}”?`}
        description="The subscribe URL stops working right away. Events and notes are not changed."
        confirmLabel="Delete feed"
        destructive
        onConfirm={() => void runRemove(props.feed.id).then(refresh.bump)}
      />
    </HStack>
  );
}
