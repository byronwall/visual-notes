import { A } from "@solidjs/router";
import { UsersIcon } from "lucide-solid";
import { css } from "styled-system/css";
import { formatPeriod, type OverlapKind } from "~/lib/people/career-periods";
import type { Colleague } from "~/lib/people/types";

const row = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  columnGap: "1.5",
  rowGap: "1",
  mt: "2",
  pt: "2",
  borderTopWidth: "1px",
  borderColor: "border",
  fontSize: "xs",
  color: "fg.muted",
  "& a": { color: "fg.default", fontWeight: "medium" },
});
const icon = css({ alignSelf: "center", color: "fg.subtle" });
const badge = css({
  px: "1.5",
  borderRadius: "l1",
  fontSize: "xs",
  lineHeight: "1.5",
  fontWeight: "medium",
  borderWidth: "1px",
  borderColor: "border",
  color: "fg.muted",
  "&[data-kind=overlap]": {
    bg: "blue.3",
    color: "blue.11",
    borderColor: "transparent",
  },
  "&[data-kind=possible]": {
    bg: "amber.3",
    color: "amber.11",
    borderColor: "transparent",
  },
});

export const OVERLAP_LABELS: Record<OverlapKind, string> = {
  overlap: "Overlapped",
  possible: "Possible overlap",
  unknown: "Dates insufficient",
  none: "No overlap",
};

/** "Also here: Sam Ortiz, Engineer, Jan 2016 – Mar 2020 [Overlapped Jun 2017 – Jul 2019]" */
export function OverlapRow(props: { colleague: Colleague }) {
  const c = () => props.colleague;
  const span = () =>
    c().overlap.from || c().overlap.to
      ? `${c().overlap.from ?? "?"} – ${c().overlap.to ?? "?"}`
      : null;
  return (
    <div class={row} data-overlap={c().overlap.kind} title={c().overlap.note}>
      <span>Also here:</span>
      <UsersIcon class={icon} size={13} aria-hidden="true" />
      <span>
        <A href={`/people/${c().person.id}`}>{c().person.displayName}</A>
        {`, ${[c().other.role, formatPeriod(c().other)].filter(Boolean).join(", ")}`}
      </span>
      <span class={badge} data-kind={c().overlap.kind}>
        {OVERLAP_LABELS[c().overlap.kind]}
        {c().overlap.kind === "overlap" && span() ? ` ${span()}` : ""}
      </span>
    </div>
  );
}
