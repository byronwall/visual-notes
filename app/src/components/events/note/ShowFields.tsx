import { Show, type VoidComponent } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { Grid, HStack } from "styled-system/jsx";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import * as Switch from "~/components/ui/switch";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { isValidTimeZone } from "~/lib/events/time";
import {
  DEFAULT_TIME_ZONE,
  OCCURRENCE_STATUSES,
  STATUS_LABELS,
  type OccurrenceStatus,
} from "~/lib/events/types";
import { DecisionSelect } from "./DecisionSelect";
import { FieldRow } from "./EventDetailsForm";
import { PlacePicker } from "./PlacePicker";
import type { ShowDraft } from "./show-draft";

const STATUS_ITEMS = OCCURRENCE_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

/** Every editable field of one show, bound to a draft store. */
export const ShowFields: VoidComponent<{
  draft: ShowDraft;
  setDraft: SetStoreFunction<ShowDraft>;
}> = (props) => {
  const d = () => props.draft;
  const zoneInvalid = () => {
    const zone = d().timeZone.trim();
    return zone !== "" && !isValidTimeZone(zone);
  };

  return (
    <Grid gridTemplateColumns="6rem minmax(0, 1fr)" columnGap="3" rowGap="2">
      <FieldRow label="Date">
        <HStack gap="1.5" flexWrap="wrap">
          <Input
            size="xs"
            type="date"
            aria-label="Date"
            w="36"
            required
            value={d().date}
            onInput={(e) => props.setDraft("date", e.currentTarget.value)}
          />
          <Text textStyle="xs" color="fg.muted">
            to
          </Text>
          <Input
            size="xs"
            type="date"
            aria-label="End date"
            w="36"
            min={d().date}
            value={d().endDate}
            onInput={(e) => props.setDraft("endDate", e.currentTarget.value)}
          />
        </HStack>
      </FieldRow>
      <FieldRow label="Time">
        <HStack gap="1.5" flexWrap="wrap">
          <Input
            size="xs"
            type="time"
            aria-label="Start time"
            w="28"
            value={d().time}
            onInput={(e) => props.setDraft("time", e.currentTarget.value)}
          />
          <Text textStyle="xs" color="fg.muted">
            to
          </Text>
          <Input
            size="xs"
            type="time"
            aria-label="End time"
            w="28"
            disabled={!d().time}
            value={d().endTime}
            onInput={(e) => props.setDraft("endTime", e.currentTarget.value)}
          />
        </HStack>
        <Text textStyle="xs" color="fg.subtle" mt="1">
          <Show when={d().time} fallback="No start time: all day.">
            An earlier end time runs past midnight.
          </Show>
        </Text>
      </FieldRow>
      <FieldRow label="Confirmed">
        <Switch.Root
          size="sm"
          checked={d().timeConfirmed}
          onCheckedChange={(e) =>
            props.setDraft("timeConfirmed", Boolean(e.checked))
          }
          pt="1"
        >
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label textStyle="xs" color="fg.muted">
            {d().timeConfirmed ? "Time confirmed" : "Time TBD (all-day entry)"}
          </Switch.Label>
        </Switch.Root>
      </FieldRow>
      <FieldRow label="Time zone">
        <Input
          size="xs"
          aria-label="Time zone"
          placeholder={DEFAULT_TIME_ZONE}
          aria-invalid={zoneInvalid()}
          value={d().timeZone}
          onInput={(e) => props.setDraft("timeZone", e.currentTarget.value)}
        />
        <Show when={zoneInvalid()}>
          <Text textStyle="xs" color="red.fg" mt="0.5">
            Use an IANA zone such as America/Chicago.
          </Text>
        </Show>
      </FieldRow>
      <FieldRow label="Label">
        <Input
          size="xs"
          aria-label="Label"
          placeholder="e.g. Late show"
          value={d().label}
          onInput={(e) => props.setDraft("label", e.currentTarget.value)}
        />
      </FieldRow>
      <FieldRow label="Place">
        <PlacePicker
          place={d().place}
          emptyLabel="Same as event"
          onChange={(place) => props.setDraft("place", place)}
        />
      </FieldRow>
      <FieldRow label="Tickets">
        <Input
          size="xs"
          aria-label="Ticket status"
          placeholder="e.g. Bought 2, on sale Fri"
          value={d().ticketStatus}
          onInput={(e) => props.setDraft("ticketStatus", e.currentTarget.value)}
        />
      </FieldRow>
      <FieldRow label="Status">
        <SimpleSelect
          items={STATUS_ITEMS}
          value={d().status}
          onChange={(v) => v && props.setDraft("status", v as OccurrenceStatus)}
          size="xs"
          minW="32"
          sameWidth={false}
          skipPortal={false}
          positioning={{ placement: "bottom-start", strategy: "fixed" }}
        />
      </FieldRow>
      <FieldRow label="Decision">
        <DecisionSelect
          value={d().decision}
          unreviewedLabel="Same as event"
          onChange={(decision) => props.setDraft("decision", decision)}
        />
      </FieldRow>
      <FieldRow label="Decision note">
        <Textarea
          size="xs"
          rows={2}
          aria-label="Decision note"
          value={d().decisionNote}
          onInput={(e) => props.setDraft("decisionNote", e.currentTarget.value)}
        />
      </FieldRow>
    </Grid>
  );
};
