import { A } from "@solidjs/router";
import { MapPinIcon } from "lucide-solid";
import { Show } from "solid-js";
import { css } from "styled-system/css";
import { formatShowTime } from "~/lib/events/format";
import type { OccurrenceListItem } from "~/lib/events/types";
import { DecisionChip } from "./DecisionChip";
import { ShowStatusBadge } from "./ShowStatusBadge";

const row = css({
  display: "grid",
  gridTemplateColumns: {
    base: "minmax(0, 1fr) auto",
    md: "8.5rem minmax(0, 1fr) minmax(0, 13rem) auto",
  },
  gridTemplateAreas: {
    base: `"time chip" "title title" "place place"`,
    md: `"time title place chip"`,
  },
  alignItems: "center",
  columnGap: "3",
  rowGap: "0.5",
  px: "2",
  py: { base: "2", md: "1.5" },
  borderRadius: "l2",
  _hover: { bg: "bg.subtle" },
  "&[data-cancelled] [data-title]": {
    textDecoration: "line-through",
    color: "fg.muted",
  },
});
const time = css({
  gridArea: "time",
  fontSize: "sm",
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});
const titleCell = css({
  gridArea: "title",
  display: "flex",
  alignItems: "center",
  gap: "2",
  minW: "0",
});
const titleLink = css({
  fontSize: "sm",
  fontWeight: "medium",
  color: "fg.default",
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
  gridArea: "place",
  display: "flex",
  alignItems: "center",
  gap: "1",
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
  gridArea: "chip",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "2",
});

/** One show: time, note title, label, place, status, and decision. */
export function UpcomingRow(props: { show: OccurrenceListItem }) {
  const s = () => props.show;
  return (
    <div
      class={row}
      data-show-row={s().id}
      data-cancelled={s().status === "cancelled" ? "" : undefined}
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
              <MapPinIcon size={12} />
              <span>{p().name}</span>
            </>
          )}
        </Show>
      </div>
      <div class={chipCell}>
        <ShowStatusBadge status={s().status} />
        <DecisionChip show={s()} />
      </div>
    </div>
  );
}
