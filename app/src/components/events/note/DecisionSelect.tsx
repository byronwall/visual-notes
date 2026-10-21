import type { VoidComponent } from "solid-js";
import { SimpleSelect } from "~/components/ui/simple-select";
import {
  DECISION_LABELS,
  EVENT_DECISIONS,
  type EventDecision,
} from "~/lib/events/types";

const ITEMS = EVENT_DECISIONS.map((value) => ({
  value,
  label: DECISION_LABELS[value],
}));

/** Compact decision picker, portalled with fixed positioning for the side panel. */
export const DecisionSelect: VoidComponent<{
  value: EventDecision;
  onChange: (next: EventDecision) => void;
  /** Label for the unreviewed option, e.g. "Same as event". */
  unreviewedLabel?: string;
  minW?: string;
}> = (props) => {
  const items = () =>
    props.unreviewedLabel
      ? ITEMS.map((item) =>
          item.value === "unreviewed"
            ? { ...item, label: props.unreviewedLabel! }
            : item,
        )
      : ITEMS;
  return (
    <SimpleSelect
      items={items()}
      value={props.value}
      onChange={(next) => {
        if (next && next !== props.value) props.onChange(next as EventDecision);
      }}
      size="xs"
      minW={props.minW ?? "32"}
      sameWidth={false}
      skipPortal={false}
      positioning={{ placement: "bottom-start", strategy: "fixed" }}
    />
  );
};
