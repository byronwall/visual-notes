import { useAction } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { HStack } from "styled-system/jsx";
import { DateInput } from "~/components/DateInput";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import { formatDay, todayLocal } from "~/lib/people/dates";
import {
  addFollowupAction,
  setCadenceAction,
} from "~/services/people/people.actions";
import { fetchFollowups } from "~/services/people/people.queries";
import { createKeptAsync, onDemand } from "~/utils/kept-async";
import { saveErrorText } from "./capture-state";
import {
  ProfileSection,
  emptyText,
  errorText,
  inlineForm,
  rowMain,
  rowMeta,
  sectionRow,
} from "./profile-section";

const CADENCES = [
  { label: "Off", value: "" },
  { label: "Every month", value: "30" },
  { label: "Every 2 months", value: "60" },
  { label: "Every 3 months", value: "90" },
  { label: "Every 6 months", value: "182" },
  { label: "Every year", value: "365" },
];

/** Opt-in cadence and this person's open reasons to reconnect. */
export function ReconnectSection(props: {
  personId: string;
  everyDays: number | null;
}) {
  const setCadence = useAction(setCadenceAction);
  const add = useAction(addFollowupAction);
  // createAsync follows action revalidation, so a saved reason shows at once.
  const items = createKeptAsync(
    () =>
      fetchFollowups({
        personId: props.personId,
        upcomingDays: 3650,
        include: ["pending", "snoozed"],
      }),
    onDemand,
  );
  const [adding, setAdding] = createSignal(false);
  const [reason, setReason] = createSignal("");
  const [day, setDay] = createSignal(todayLocal());
  const [message, setMessage] = createSignal("");

  const save = async (e: Event) => {
    e.preventDefault();
    if (!reason().trim()) return setMessage("Write a reason.");
    try {
      await add({
        personId: props.personId,
        reason: reason(),
        suggestedOn: day(),
      });
      setAdding(false);
      setReason("");
      setMessage("");
    } catch (err) {
      console.warn("[people] add reconnect failed", err);
      setMessage(saveErrorText(err, "Could not save. Try again."));
    }
  };

  return (
    <ProfileSection
      title="Reconnect"
      addLabel="Add reason"
      onAdd={() => setAdding(true)}
    >
      <SimpleSelect
        size="sm"
        skipPortal={false}
        items={CADENCES}
        placeholder="Off"
        value={props.everyDays ? String(props.everyDays) : ""}
        onChange={(v) =>
          void setCadence({
            personId: props.personId,
            days: v ? Number(v) : null,
          })
        }
      />
      <Show when={!props.everyDays && !items.latest?.length && !adding()}>
        <span class={emptyText}>
          Off. Turn it on to get reminders after a quiet stretch.
        </span>
      </Show>
      <For each={items.latest}>
        {(i) => (
          <div class={sectionRow} data-reconnect-item={i.reason}>
            <div class={rowMain}>
              {i.reason}
              <div class={rowMeta}>
                {i.status === "snoozed" && i.snoozedUntil
                  ? `Snoozed until ${formatDay(i.snoozedUntil)}`
                  : formatDay(i.suggestedOn)}
              </div>
            </div>
          </div>
        )}
      </For>
      <Show when={adding()}>
        <form class={inlineForm} onSubmit={save}>
          <Input
            size="sm"
            aria-label="Reason to reconnect"
            placeholder="Ask how the new job is going"
            value={reason()}
            ref={(el) => requestAnimationFrame(() => el.focus())}
            onInput={(e) => setReason(e.currentTarget.value)}
          />
          <DateInput
            size="sm"
            aria-label="Suggest on"
            value={day()}
            onChange={(v) => setDay(v ?? todayLocal())}
          />
          <Show when={message()}>
            <span class={errorText} role="alert">
              {message()}
            </span>
          </Show>
          <HStack gap="2">
            <Button size="xs" type="submit">
              Save
            </Button>
            <Button size="xs" variant="plain" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </HStack>
        </form>
      </Show>
    </ProfileSection>
  );
}
