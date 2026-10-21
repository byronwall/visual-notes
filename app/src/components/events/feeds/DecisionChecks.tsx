import { For } from "solid-js";
import { HStack } from "styled-system/jsx";
import * as Checkbox from "~/components/ui/checkbox";
import {
  DECISION_LABELS,
  EVENT_DECISIONS,
  type EventDecision,
} from "~/lib/events/types";

/** Multi-select of decisions as a row of checkboxes, in canonical order. */
export function DecisionChecks(props: {
  value: EventDecision[];
  onChange: (next: EventDecision[]) => void;
}) {
  const toggle = (decision: EventDecision, on: boolean) => {
    const set = new Set(props.value);
    if (on) set.add(decision);
    else set.delete(decision);
    props.onChange(EVENT_DECISIONS.filter((d) => set.has(d)));
  };
  return (
    <HStack gap="3" rowGap="2" flexWrap="wrap">
      <For each={EVENT_DECISIONS}>
        {(decision) => (
          <Checkbox.Root
            size="sm"
            checked={props.value.includes(decision)}
            onCheckedChange={(d) => toggle(decision, d.checked === true)}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Label fontSize="sm">
              {DECISION_LABELS[decision]}
            </Checkbox.Label>
          </Checkbox.Root>
        )}
      </For>
    </HStack>
  );
}
