import { CalendarDaysIcon, ChevronDownIcon } from "lucide-solid";
import { Show, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { formatShowWhen } from "~/lib/events/format";
import { DECISION_LABELS, type NoteEvent } from "~/lib/events/types";
import { isPastShow } from "./ShowsList";

const rowClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  w: "full",
  minW: 0,
  h: "7",
  px: "1",
  borderRadius: "l2",
  fontSize: "sm",
  color: "fg.default",
  textAlign: "left",
  cursor: "pointer",
  transitionProperty: "background-color",
  transitionDuration: "140ms",
  _hover: { bg: "gray.a2" },
  _active: { bg: "gray.a3" },
});

const chevronClass = css({
  flexShrink: 0,
  ml: "auto",
  color: "fg.muted",
  transitionProperty: "transform",
  transitionDuration: "140ms",
  "[aria-expanded=true] &": { transform: "rotate(180deg)" },
});

/** One line for a note's event: next show, decision, and place. */
export const EventSummaryRow: VoidComponent<{
  event: NoteEvent;
  open: boolean;
  onToggle: () => void;
}> = (props) => {
  const shows = () => props.event.occurrences;
  const next = () => {
    const now = Date.now();
    return shows().find((s) => !isPastShow(s, now)) ?? shows().at(-1);
  };
  const details = () =>
    [
      shows().length > 1 ? `${shows().length} shows` : null,
      props.event.decision === "unreviewed"
        ? null
        : DECISION_LABELS[props.event.decision],
      props.event.place?.name,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <button
      type="button"
      class={rowClass}
      aria-expanded={props.open}
      aria-label={props.open ? "Hide event details" : "Show event details"}
      onClick={() => props.onToggle()}
    >
      <Box as="span" display="inline-flex" flexShrink="0" color="fg.muted">
        <CalendarDaysIcon size={14} />
      </Box>
      <Box as="span" flexShrink="0" whiteSpace="nowrap">
        <Show when={next()} fallback="No shows">
          {(show) => formatShowWhen(show(), new Date().getFullYear())}
        </Show>
      </Box>
      <Show when={details()}>
        <Box
          as="span"
          minW="0"
          color="fg.muted"
          fontSize="xs"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
        >
          {details()}
        </Box>
      </Show>
      <ChevronDownIcon size={14} class={chevronClass} />
    </button>
  );
};
