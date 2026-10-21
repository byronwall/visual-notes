import { ChevronDownIcon } from "lucide-solid";
import { For } from "solid-js";
import { Portal } from "solid-js/web";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Menu from "~/components/ui/menu";
import {
  DECISION_LABELS,
  EVENT_DECISIONS,
  type EventDecision,
} from "~/lib/events/types";
import { DecisionDot } from "./DecisionChip";

const summary = (selected: EventDecision[]) => {
  if (selected.length === 0) return "Any decision";
  if (selected.length === 1) return DECISION_LABELS[selected[0]!];
  return `${selected.length} decisions`;
};

/** Multi-select of effective decisions; an empty selection means all. */
export function DecisionFilterMenu(props: {
  selected: EventDecision[];
  onChange: (next: EventDecision[]) => void;
}) {
  const toggle = (d: EventDecision, on: boolean) =>
    props.onChange(
      EVENT_DECISIONS.filter((x) =>
        x === d ? on : props.selected.includes(x),
      ),
    );
  return (
    <Menu.Root
      size="sm"
      closeOnSelect={false}
      positioning={{ placement: "bottom-start" }}
    >
      <Menu.Trigger
        asChild={(triggerProps) => (
          <Button
            {...triggerProps}
            size="sm"
            variant="outline"
            data-active={props.selected.length ? "" : undefined}
          >
            {summary(props.selected)}
            <ChevronDownIcon size={14} />
          </Button>
        )}
      />
      <Portal>
        <Menu.Positioner zIndex="popover">
          <Menu.Content zIndex="popover">
            <For each={EVENT_DECISIONS}>
              {(d) => (
                <Menu.CheckboxItem
                  value={d}
                  checked={props.selected.includes(d)}
                  onCheckedChange={(on) => toggle(d, on)}
                >
                  <HStack gap="2" flex="1">
                    <DecisionDot decision={d} />
                    <Menu.ItemText>{DECISION_LABELS[d]}</Menu.ItemText>
                  </HStack>
                  <Menu.ItemIndicator />
                </Menu.CheckboxItem>
              )}
            </For>
            <Menu.Separator />
            <Menu.Item
              value="any"
              disabled={props.selected.length === 0}
              onSelect={() => props.onChange([])}
            >
              Any decision
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
