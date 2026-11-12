import { For, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { todayLocal } from "~/lib/people/dates";
import {
  fetchFollowupDigest,
  fetchFollowups,
} from "~/services/people/people.queries";
import { createKeptAsync } from "~/utils/kept-async";
import { FollowupRow } from "./FollowupRow";

const heading = css({
  fontSize: "sm",
  fontWeight: "semibold",
  px: "2",
  pb: "1",
  mt: "6",
  borderBottomWidth: "1px",
  borderColor: "border",
  _first: { mt: "0" },
});
const empty = css({
  p: "4",
  borderRadius: "l3",
  bg: "bg.subtle",
  fontSize: "sm",
  color: "fg.muted",
});
const muted = css({ fontSize: "sm", color: "fg.muted" });

/** Due reasons to reconnect, what is coming up, and what is snoozed. */
export function ReconnectView() {
  const today = todayLocal();
  const queue = createKeptAsync(() => fetchFollowups({ upcomingDays: 30 }));
  const snoozed = createKeptAsync(() =>
    fetchFollowups({ include: ["snoozed"] }),
  );
  const [showDigest, setShowDigest] = createSignal(false);
  const digest = createKeptAsync(() =>
    showDigest() ? fetchFollowupDigest() : Promise.resolve(""),
  );
  const due = () => (queue.latest ?? []).filter((i) => i.suggestedOn <= today);
  const upcoming = () =>
    (queue.latest ?? []).filter((i) => i.suggestedOn > today);

  return (
    <>
      <HStack gap="3" mb="4" flexWrap="wrap">
        <p class={muted}>
          Suggestions come from people you opted in (Reconnect on a profile) and
          from reasons you or an agent added. Done, Snooze, and Dismiss never
          count as contact.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowDigest(!showDigest())}
        >
          {showDigest() ? "Hide digest" : "Digest"}
        </Button>
      </HStack>
      <Show when={showDigest() && digest.latest}>
        <Textarea
          readOnly
          rows={6}
          value={digest.latest}
          aria-label="Digest"
          mb="4"
          fontFamily="mono"
          fontSize="xs"
        />
      </Show>
      <h2 class={heading}>Due now ({due().length})</h2>
      <Show
        when={due().length}
        fallback={<div class={empty}>Nothing due. Nice.</div>}
      >
        <For each={due()}>{(item) => <FollowupRow item={item} />}</For>
      </Show>
      <Show when={upcoming().length}>
        <h2 class={heading}>Next 30 days ({upcoming().length})</h2>
        <For each={upcoming()}>{(item) => <FollowupRow item={item} />}</For>
      </Show>
      <Show when={snoozed.latest?.length}>
        <h2 class={heading}>Snoozed ({snoozed.latest!.length})</h2>
        <For each={snoozed.latest}>{(item) => <FollowupRow item={item} />}</For>
      </Show>
    </>
  );
}
