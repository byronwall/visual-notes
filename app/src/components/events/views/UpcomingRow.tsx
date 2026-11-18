import { A } from "@solidjs/router";
import { MapPinIcon } from "lucide-solid";
import { Show } from "solid-js";
import { css } from "styled-system/css";
import { RowListRow } from "~/components/ui/row-list";
import { formatShowTime } from "~/lib/events/format";
import type { OccurrenceListItem } from "~/lib/events/types";
import { DecisionChip } from "./DecisionChip";
import { ShowStatusBadge } from "./ShowStatusBadge";

// Columns come from UpcomingList. On phones a row is two lines plus a place
// line: time and decision on top, then the title, then the place.
const row = css({
  py: { base: "2", md: "1.5" },
  rowGap: "0.5",
  md: { gridColumn: "2 / -1" },
  _hover: { bg: "bg.subtle" },
  "&[data-cancelled] [data-title]": {
    textDecoration: "line-through",
    color: "fg.muted",
  },
  "&[data-past]": { color: "fg.muted" },
});
const time = css({
  gridColumn: { base: "1", md: "auto" },
  gridRow: { base: "1", md: "auto" },
  fontSize: "sm",
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});
const titleCell = css({
  gridColumn: { base: "1 / -1", md: "auto" },
  display: "flex",
  alignItems: "center",
  gap: "2",
  minW: "0",
});
const titleLink = css({
  fontSize: "sm",
  fontWeight: "medium",
  color: "inherit",
  textDecoration: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minW: "0",
  _hover: { textDecoration: "underline", textUnderlineOffset: "2px" },
});
const label = css({
  fontSize: "xs",
  color: "fg.subtle",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  flexShrink: "1",
  minW: "0",
});
const place = css({
  gridColumn: { base: "1 / -1", md: "auto" },
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  minW: "0",
  fontSize: "sm",
  color: "fg.muted",
  "& span": {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  "& svg": { flexShrink: "0", color: "fg.subtle" },
});
const chipCell = css({
  gridColumn: { base: "2", md: "auto" },
  gridRow: { base: "1", md: "auto" },
  display: "flex",
  // Every chip takes the column's width, so the labels start in one line.
  "& > button": { w: "full", justifyContent: "space-between" },
});

/** One show: time, title with label and status, place, and decision. */
export function UpcomingRow(props: {
  show: OccurrenceListItem;
  past?: boolean;
}) {
  const s = () => props.show;
  return (
    <RowListRow
      class={row}
      data-show-row={s().id}
      data-cancelled={s().status === "cancelled" ? "" : undefined}
      data-past={props.past ? "" : undefined}
    >
      <span class={time}>{formatShowTime(s())}</span>
      <div class={titleCell}>
        <A
          href={`/docs/${s().docId}`}
          class={titleLink}
          title={s().title}
          data-title
        >
          {s().title || "Untitled"}
        </A>
        <ShowStatusBadge status={s().status} />
        <Show when={s().label}>
          {(text) => (
            <span class={label} title={text()}>
              {text()}
            </span>
          )}
        </Show>
      </div>
      <div class={place} title={s().effectivePlace?.address || undefined}>
        <Show when={s().effectivePlace}>
          {(p) => (
            <>
              <MapPinIcon size={13} />
              <span>{p().name}</span>
            </>
          )}
        </Show>
      </div>
      <div class={chipCell}>
        <DecisionChip show={s()} />
      </div>
    </RowListRow>
  );
}
