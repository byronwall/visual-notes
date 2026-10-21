import { CalendarPlusIcon } from "lucide-solid";
import { Show } from "solid-js";
import { css } from "styled-system/css";

const box = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "2",
  p: { base: "4", md: "6" },
  borderRadius: "l3",
  bg: "bg.subtle",
  color: "fg.muted",
  fontSize: "sm",
  "& strong": { color: "fg.default", fontWeight: "semibold" },
  "& ol": { pl: "5", listStyle: "decimal", lineHeight: "1.7" },
});
const head = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  fontSize: "md",
  fontWeight: "semibold",
  color: "fg.default",
});
const link = css({
  color: "fg.default",
  textDecoration: "underline",
  cursor: "pointer",
  textUnderlineOffset: "2px",
});

/**
 * No shows to list. With filters on, offer to clear them; otherwise explain
 * where events come from.
 */
export function EventsEmptyState(props: {
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <div class={box}>
      <Show
        when={!props.filtered}
        fallback={
          <>
            <span class={head}>No shows match these filters.</span>
            <button type="button" class={link} onClick={props.onClear}>
              Clear filters
            </button>
          </>
        }
      >
        <span class={head}>
          <CalendarPlusIcon size={18} /> No upcoming shows yet
        </span>
        <span>Events live on notes. To add one:</span>
        <ol>
          <li>Open or create a note for the event.</li>
          <li>
            Open the note's <strong>side panel</strong> and find the{" "}
            <strong>Event</strong> section.
          </li>
          <li>Add a show with its date, time, and place.</li>
        </ol>
      </Show>
    </div>
  );
}
