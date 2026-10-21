import { useAction } from "@solidjs/router";
import { ChevronDownIcon } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import * as Menu from "~/components/ui/menu";
import { optionColorVars } from "~/lib/collections/colors";
import { DECISION_COLORS } from "~/lib/events/filters";
import {
  DECISION_LABELS,
  EVENT_DECISIONS,
  type EventDecision,
  type OccurrenceListItem,
} from "~/lib/events/types";
import { saveOccurrence } from "~/services/events/events.actions";
import { useShowsRefresh } from "./ShowsRefresh";

const dot = css({
  display: "inline-block",
  w: "2",
  h: "2",
  borderRadius: "full",
  flexShrink: "0",
  bg: "var(--chip-ink)",
});

const chip = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  h: "6",
  pl: "2",
  pr: "1",
  borderRadius: "full",
  fontSize: "xs",
  fontWeight: "medium",
  whiteSpace: "nowrap",
  cursor: "pointer",
  bg: "var(--chip-bg)",
  color: "var(--chip-fg)",
  _dark: { bg: "var(--chip-bg-dark)", color: "var(--chip-fg-dark)" },
  _hover: { filter: "brightness(0.95)" },
  _focusVisible: { outline: "2px solid", outlineColor: "colorPalette.9" },
  "& svg": { opacity: "0.7" },
});

const inherited = css({ fontSize: "xs", color: "fg.subtle", ml: "auto" });

export const DecisionDot = (props: { decision: EventDecision }) => (
  <span class={dot} style={optionColorVars(DECISION_COLORS[props.decision])} />
);

/** Effective decision for a show, with a menu that sets the show's own. */
export function DecisionChip(props: { show: OccurrenceListItem }) {
  const save = useAction(saveOccurrence);
  const refresh = useShowsRefresh();
  // Optimistic own decision until the refetched row arrives.
  const [pending, setPending] = createSignal<EventDecision | null>(null);
  const own = () => pending() ?? props.show.decision;
  const decision = () =>
    own() === "unreviewed" ? props.show.eventDecision : own();
  const fromEvent = () => own() === "unreviewed";
  const pick = async (next: string) => {
    if (next === own()) return;
    setPending(next as EventDecision);
    try {
      await save({
        id: props.show.id,
        patch: { decision: next as EventDecision },
      });
      await refresh();
    } catch (err) {
      console.warn("[events-views] decision save failed", err);
    } finally {
      setPending(null);
    }
  };
  return (
    <Menu.Root size="sm" positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger
        asChild={(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            class={chip}
            style={optionColorVars(DECISION_COLORS[decision()])}
            aria-label={`Decision: ${DECISION_LABELS[decision()]}. Change`}
            title={
              fromEvent()
                ? "From the event decision; pick one to set this show's own"
                : "This show's decision"
            }
          >
            {DECISION_LABELS[decision()]}
            <ChevronDownIcon size={12} />
          </button>
        )}
      />
      <Portal>
        <Menu.Positioner zIndex="popover">
          <Menu.Content zIndex="popover">
            <Menu.RadioItemGroup
              value={own()}
              onValueChange={(d) => void pick(d.value)}
            >
              <For each={EVENT_DECISIONS}>
                {(d) => (
                  <Menu.RadioItem value={d}>
                    <HStack gap="2" flex="1">
                      <DecisionDot decision={d} />
                      <Menu.ItemText>
                        {d === "unreviewed"
                          ? "Use event's"
                          : DECISION_LABELS[d]}
                      </Menu.ItemText>
                      <Show when={d === "unreviewed"}>
                        <span class={inherited}>
                          {DECISION_LABELS[props.show.eventDecision]}
                        </span>
                      </Show>
                    </HStack>
                    <Menu.ItemIndicator />
                  </Menu.RadioItem>
                )}
              </For>
            </Menu.RadioItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
