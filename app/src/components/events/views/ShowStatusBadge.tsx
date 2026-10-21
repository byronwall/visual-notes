import { Show } from "solid-js";
import { css } from "styled-system/css";
import { STATUS_LABELS, type OccurrenceStatus } from "~/lib/events/types";

const badge = css({
  display: "inline-flex",
  alignItems: "center",
  h: "5",
  px: "1.5",
  borderRadius: "l1",
  fontSize: "2xs",
  fontWeight: "semibold",
  textTransform: "uppercase",
  letterSpacing: "wide",
  whiteSpace: "nowrap",
  bg: "bg.muted",
  color: "fg.muted",
  "&[data-status=cancelled]": { bg: "red.a3", color: "red.11" },
  "&[data-status=sold_out]": { bg: "amber.a3", color: "amber.11" },
  "&[data-status=postponed]": { bg: "blue.a3", color: "blue.11" },
});

/** Nothing for a scheduled show; a small tag for the others. */
export const ShowStatusBadge = (props: { status: OccurrenceStatus }) => (
  <Show when={props.status !== "scheduled"}>
    <span class={badge} data-status={props.status}>
      {STATUS_LABELS[props.status]}
    </span>
  </Show>
);
