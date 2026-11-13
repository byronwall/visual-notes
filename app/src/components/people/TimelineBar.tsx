import { Show, createMemo } from "solid-js";
import { css } from "styled-system/css";
import { formatPeriod } from "~/lib/people/career-periods";
import type { Affiliation } from "~/lib/people/types";
import {
  across,
  at,
  fraction,
  roleBar,
  type Axis,
} from "./company-timeline-model";

// A role's bar. Its label rides in ::after, shown on hover and keyboard
// focus, and opens toward the middle so it never leaves the track.
const bar = css({
  position: "absolute",
  top: "1",
  h: "4",
  minW: "1.5",
  borderRadius: "l1",
  outline: "none",
  bg: "blue.5",
  borderColor: "blue.7",
  "&[data-status=ended]": { bg: "gray.8", borderColor: "gray.8" },
  "&[data-status=current]": { bg: "green.7", borderColor: "green.7" },
  "&[data-tail]::before": {
    content: '""',
    position: "absolute",
    left: "100%",
    top: "50%",
    w: "var(--tail)",
    borderTopWidth: "2px",
    borderTopStyle: "dashed",
    borderColor: "inherit",
    transform: "translateY(-50%)",
  },
  "&:hover, &:focus-visible": {
    boxShadow:
      "0 0 0 2px var(--colors-bg-default), 0 0 0 4px var(--colors-fg-default)",
  },
  "&:hover::after, &:focus-visible::after": {
    content: "attr(data-label)",
    position: "absolute",
    bottom: "calc(100% + 6px)",
    left: "0",
    zIndex: "tooltip",
    whiteSpace: "nowrap",
    px: "2",
    py: "1",
    borderRadius: "l2",
    fontSize: "xs",
    bg: "fg.default",
    color: "bg.default",
    pointerEvents: "none",
  },
  "&[data-anchor=end]:hover::after, &[data-anchor=end]:focus-visible::after": {
    left: "auto",
    right: "0",
  },
});
const undated = css({
  fontSize: "xs",
  color: "fg.subtle",
  whiteSpace: "nowrap",
});

const label = (a: Affiliation) =>
  [a.role ?? "Role not recorded", formatPeriod(a)].join(" · ");

/** One role on the company axis, or its text when it has no start date. */
export function TimelineBar(props: {
  role: Affiliation;
  person: string;
  axis: Axis | null;
  today: string;
}) {
  const geo = createMemo(() => {
    const a = props.axis;
    const b = a ? roleBar(props.role, props.today) : null;
    if (!a || !b) return null;
    const tail =
      b.tail === "unknown"
        ? "6%"
        : b.tail && b.tail > b.to
          ? across(a, b.to, b.tail)
          : null;
    return {
      left: at(a, b.from),
      width: across(a, b.from, b.to),
      tail,
      anchorEnd: fraction(a, b.from) > 0.5,
    };
  });
  return (
    <Show
      when={geo()}
      // The row already names the role; the track says what is missing.
      fallback={
        <span class={undated}>
          {props.role.role ? formatPeriod(props.role) : label(props.role)}
        </span>
      }
    >
      {(g) => (
        <span
          class={bar}
          data-status={props.role.status}
          data-tail={g().tail ? "" : undefined}
          data-anchor={g().anchorEnd ? "end" : undefined}
          data-label={label(props.role)}
          tabindex="0"
          aria-label={`${props.person}: ${label(props.role)}`}
          style={{
            left: g().left,
            width: g().width,
            "--tail": g().tail ?? "0",
          }}
        />
      )}
    </Show>
  );
}
