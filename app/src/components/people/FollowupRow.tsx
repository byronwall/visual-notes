import { A, useAction } from "@solidjs/router";
import { Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import {
  addDays,
  daysAgoLabel,
  formatDay,
  todayLocal,
} from "~/lib/people/dates";
import type { Followup } from "~/server/people/reconnect-store";
import { updateFollowupAction } from "~/services/people/people.actions";
import { openCapture, saveErrorText } from "./capture-state";

const row = css({
  display: "grid",
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    md: "minmax(10rem, 14rem) minmax(0, 1fr) auto",
  },
  gap: { base: "1", md: "4" },
  alignItems: "start",
  px: "2",
  py: "2.5",
  borderBottomWidth: "1px",
  borderColor: "border",
  fontSize: "sm",
  _hover: { bg: "bg.subtle" },
  "&:hover [data-quiet-actions], &:focus-within [data-quiet-actions]": {
    opacity: 1,
  },
});
// Secondary actions stay quiet until the row is hovered or focused.
const quiet = css({
  display: "contents",
  md: { display: "flex", gap: "1", opacity: 0 },
});
const name = css({ fontWeight: "medium" });
const muted = css({ color: "fg.muted", fontSize: "xs" });
const actions = css({
  display: "flex",
  gap: "1",
  flexWrap: "wrap",
  justifyContent: { md: "flex-end" },
});
const error = css({ color: "red.11", fontSize: "xs" });

/** One reason to reconnect with its actions. None of them count as contact. */
export function FollowupRow(props: { item: Followup; showPerson?: boolean }) {
  const act = useAction(updateFollowupAction);
  const [message, setMessage] = createSignal("");
  const today = todayLocal();
  const i = () => props.item;
  const run = (
    action: "snooze" | "dismiss" | "resolve" | "reopen",
    days?: number,
  ) =>
    void act({
      key: i().key,
      action,
      snoozedUntil: days ? addDays(today, days) : undefined,
    }).catch((err) => {
      console.warn("[people] reconnect action failed", err);
      setMessage(saveErrorText(err, "Could not update. Try again."));
    });

  return (
    <div class={row} data-followup={i().person.displayName}>
      <Show
        when={props.showPerson !== false}
        fallback={<span class={muted}>{formatDay(i().suggestedOn)}</span>}
      >
        <div>
          <A href={`/people/${i().person.id}`} class={name}>
            {i().person.displayName}
          </A>
          <div class={muted}>
            {i().lastContactOn
              ? `Last contact ${daysAgoLabel(i().lastContactOn!, today)}`
              : "No recorded contact"}
          </div>
        </div>
      </Show>
      <div>
        <div>{i().reason}</div>
        <Show when={i().source.text}>
          <div class={muted}>From: {i().source.text}</div>
        </Show>
        <div class={muted}>
          {i().status === "snoozed" && i().snoozedUntil
            ? `Snoozed until ${formatDay(i().snoozedUntil!)}`
            : i().suggestedOn > today
              ? `Coming up ${formatDay(i().suggestedOn)}`
              : `Suggested ${formatDay(i().suggestedOn)}`}
        </div>
        <Show when={message()}>
          <div class={error} role="alert">
            {message()}
          </div>
        </Show>
      </div>
      <div class={actions}>
        <Show
          when={i().status === "pending"}
          fallback={
            <Button size="xs" variant="plain" onClick={() => run("reopen")}>
              Bring back
            </Button>
          }
        >
          <Button
            size="xs"
            variant="outline"
            onClick={() => openCapture("interaction", [i().person])}
          >
            Log interaction
          </Button>
          <span class={quiet} data-quiet-actions>
            <Button
              size="xs"
              variant="plain"
              title="Hide for a week"
              onClick={() => run("snooze", 7)}
            >
              Snooze a week
            </Button>
            <Button
              size="xs"
              variant="plain"
              title="Hide for a month"
              onClick={() => run("snooze", 30)}
            >
              a month
            </Button>
            <Button
              size="xs"
              variant="plain"
              title="Mark done; this does not record contact"
              onClick={() => run("resolve")}
            >
              Done
            </Button>
            <Button
              size="xs"
              variant="plain"
              title="Never show this one again"
              onClick={() => run("dismiss")}
            >
              Dismiss
            </Button>
          </span>
        </Show>
      </div>
    </div>
  );
}
