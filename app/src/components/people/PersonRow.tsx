import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { css } from "styled-system/css";
import { daysAgoLabel, formatDay } from "~/lib/people/dates";
import type { PersonMatch } from "~/lib/people/types";

export const personGrid = css({
  display: "grid",
  gridTemplateColumns: {
    base: "minmax(0, 1fr) auto",
    md: "minmax(10rem, 1.2fr) minmax(0, 1.4fr) minmax(0, 1fr) 9rem",
  },
  columnGap: "4",
  alignItems: "center",
});
const row = css({
  px: "2",
  py: "2",
  borderRadius: "l2",
  cursor: "pointer",
  _hover: { bg: "bg.subtle" },
  "&[data-selected]": {
    bg: "bg.subtle",
    boxShadow: "inset 2px 0 0 var(--colors-fg-default)",
  },
});
const name = css({
  fontWeight: "medium",
  color: "fg.default",
  textDecoration: "none",
  truncate: true,
  _hover: { textDecoration: "underline" },
});
const muted = css({ fontSize: "sm", color: "fg.muted", truncate: true });
const matched = css({
  gridColumn: "1 / -1",
  fontSize: "xs",
  color: "fg.subtle",
  truncate: true,
  mt: "0.5",
});
const contactCell = css({
  fontSize: "sm",
  color: "fg.muted",
  textAlign: "right",
  whiteSpace: "nowrap",
});
const hideNarrow = css({ display: { base: "none", md: "block" } });
const empty = css({ color: "fg.subtle" });

/** One directory row. The name is a real profile link; the row selects. */
export function PersonRow(props: {
  person: PersonMatch;
  today: string;
  selected?: boolean;
  /** Second column, e.g. the current affiliation. */
  detail?: string | null;
  onSelect?: () => void;
}) {
  const p = () => props.person;
  return (
    <div
      class={`${personGrid} ${row}`}
      data-person-row={p().displayName}
      data-selected={props.selected ? "" : undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        props.onSelect?.();
      }}
    >
      <A href={`/people/${p().id}`} class={name}>
        {p().displayName}
      </A>
      <span class={`${muted} ${hideNarrow}`}>
        {props.detail ?? p().summary ?? <span class={empty}>—</span>}
      </span>
      <span class={`${muted} ${hideNarrow}`}>
        {p().contexts.join(", ") || <span class={empty}>—</span>}
      </span>
      <span
        class={contactCell}
        title={p().lastContactOn ? formatDay(p().lastContactOn!) : undefined}
      >
        {p().lastContactOn
          ? daysAgoLabel(p().lastContactOn!, props.today)
          : "No recorded contact"}
      </span>
      <Show when={p().matchedIn}>
        <span class={matched}>Matched: {p().matchedIn}</span>
      </Show>
    </div>
  );
}
