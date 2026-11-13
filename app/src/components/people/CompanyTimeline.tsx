import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import {
  compareRoles,
  firstDay,
  formatPeriod,
  lastDay,
  type OverlapKind,
} from "~/lib/people/career-periods";
import { todayLocal } from "~/lib/people/dates";
import type { Affiliation, OrganizationDetail } from "~/lib/people/types";
import { OVERLAP_LABELS } from "./OverlapRow";

type Member = OrganizationDetail["members"][number];
type Row = {
  id: string;
  name: string;
  archived: boolean;
  roles: Affiliation[];
  /** How this person's time here compares with the focused person's. */
  match: OverlapKind | "self" | null;
};

const grid = css({
  display: "grid",
  gridTemplateColumns: { base: "8.5rem minmax(0, 1fr)", md: "13rem minmax(0, 1fr)" },
  columnGap: "3",
  alignItems: "center",
});
const axis = css({ position: "relative", h: "5", fontSize: "xs", color: "fg.subtle" });
const tick = css({ position: "absolute", top: "0", transform: "translateX(-50%)" });
const row = css({
  py: "1.5",
  borderRadius: "l2",
  "&[data-match=none], &[data-match=unknown]": { opacity: 0.5 },
  "&[data-match=self]": { bg: "amber.2" },
});
const who = css({
  minW: "0",
  pl: "2",
  fontSize: "sm",
  lineHeight: "1.3",
  "& a": { fontWeight: "medium", color: "fg.default" },
});
const role = css({
  fontSize: "xs",
  color: "fg.muted",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const track = css({ position: "relative", h: "6" });
const gridline = css({
  position: "absolute",
  top: "-1.5",
  bottom: "-1.5",
  w: "1px",
  bg: "border",
  opacity: 0.6,
});
const band = css({
  position: "absolute",
  top: "0",
  bottom: "0",
  bg: "amber.3",
  opacity: 0.45,
  pointerEvents: "none",
});
// A role's bar. The label rides in ::after so hovering explains the bar
// without a title tooltip.
const bar = css({
  position: "absolute",
  top: "1",
  h: "4",
  minW: "1.5",
  borderRadius: "l1",
  bg: "blue.5",
  "&[data-status=ended]": { bg: "gray.8" },
  "&[data-status=current]": { bg: "green.7" },
  // Unseen time after the last observation, or an unknown end.
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
  "&[data-status=current][data-tail]": { borderColor: "green.7" },
  "&[data-status=ended][data-tail]": { borderColor: "gray.8" },
  _hover: { outline: "2px solid", outlineColor: "fg.default" },
  "&:hover::after": {
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
  },
});
const undated = css({ fontSize: "xs", color: "fg.subtle", pl: "1" });
const legend = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "4",
  mt: "3",
  fontSize: "xs",
  color: "fg.muted",
  "& i": {
    display: "inline-block",
    w: "3",
    h: "2",
    mr: "1.5",
    borderRadius: "l1",
    verticalAlign: "middle",
  },
});

const yearOf = (day: string) => Number(day.slice(0, 4));
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

/** Bar geometry for one role, in days; null when it has no start. */
function span(a: Affiliation, today: string) {
  if (!a.startOn) return null;
  const from = firstDay(a.startOn);
  if (a.endOn) return { from, to: lastDay(a.endOn), tail: null };
  if (a.status === "current") {
    const seen = a.observedOn ?? a.recordedOn;
    return { from, to: seen < from ? from : seen, tail: today };
  }
  // Ended or unknown with no end: a sliver at the start and a dashed "?".
  return { from, to: from, tail: "unknown" as const };
}

/**
 * Everyone recorded at one organization, one row per person, on a shared
 * year axis. With a focused person, their time here is shaded across every
 * row and other rows fade unless the stated dates overlap.
 */
export function CompanyTimeline(props: {
  members: Member[];
  focusId?: string | null;
}) {
  const today = todayLocal();
  const rows = (): Row[] => {
    const byPerson = new Map<string, Row>();
    for (const m of props.members) {
      const r = byPerson.get(m.id) ?? {
        id: m.id,
        name: m.displayName,
        archived: m.archived,
        roles: [],
        match: null,
      };
      r.roles.push(m.affiliation);
      byPerson.set(m.id, r);
    }
    const list = [...byPerson.values()];
    const focus = list.find((r) => r.id === props.focusId);
    if (focus) {
      const rank: OverlapKind[] = ["overlap", "possible", "unknown", "none"];
      for (const r of list) {
        if (r === focus) r.match = "self";
        else {
          const kinds = r.roles.flatMap((a) =>
            focus.roles.map((f) => compareRoles(f, a).kind),
          );
          r.match = rank.find((k) => kinds.includes(k)) ?? "none";
        }
      }
    }
    const latest = (r: Row) =>
      r.roles.some((a) => a.status === "current")
        ? "9999"
        : r.roles
            .map((a) => (a.endOn ? lastDay(a.endOn) : a.startOn ? firstDay(a.startOn) : ""))
            .sort()
            .at(-1) ?? "";
    return list.sort(
      (a, b) =>
        Number(b.match === "self") - Number(a.match === "self") ||
        latest(b).localeCompare(latest(a)) ||
        a.name.localeCompare(b.name),
    );
  };

  const range = () => {
    const starts = props.members
      .map((m) => m.affiliation.startOn)
      .filter((s): s is string => !!s)
      .map(firstDay);
    if (!starts.length) return null;
    const first = yearOf(starts.sort()[0]);
    const last = yearOf(today);
    return { from: `${first}-01-01`, to: `${last}-12-31`, first, last };
  };
  const pct = (day: string) => {
    const r = range()!;
    const total = dayNumber(r.to) - dayNumber(r.from);
    return `${((dayNumber(day) - dayNumber(r.from)) / total) * 100}%`;
  };
  const width = (from: string, to: string) => {
    const r = range()!;
    const total = dayNumber(r.to) - dayNumber(r.from);
    return `${((dayNumber(to) - dayNumber(from)) / total) * 100}%`;
  };
  const ticks = () => {
    const r = range()!;
    const years = r.last - r.first + 1;
    const step = years <= 12 ? 1 : years <= 30 ? 5 : 10;
    const out: number[] = [];
    for (let y = r.first; y <= r.last; y++)
      if ((y - r.first) % step === 0) out.push(y);
    // The current year gets a label unless it would crowd the last one.
    if (r.last - out[out.length - 1] >= Math.max(2, step / 2)) out.push(r.last);
    return out;
  };
  const focusBands = () => {
    const focus = rows().find((r) => r.match === "self");
    return (focus?.roles ?? [])
      .map((a) => span(a, today))
      .filter((s) => s != null)
      .map((s) => ({ from: s.from, to: s.tail && s.tail !== "unknown" ? s.tail : s.to }));
  };
  const latestRole = (r: Row) => r.roles[0];
  const label = (a: Affiliation) =>
    [a.role ?? "Role not recorded", formatPeriod(a)].join(" · ");

  return (
    <Show
      when={range()}
      fallback={
        <p class={undated}>
          No one here has dates yet. Add start dates to see who overlapped.
        </p>
      }
    >
      <div data-company-timeline>
        <div class={grid}>
          <span />
          <div class={axis}>
            <For each={ticks()}>
              {(y) => (
                <span class={tick} style={{ left: pct(`${y}-07-01`) }}>
                  {y}
                </span>
              )}
            </For>
          </div>
        </div>
        <For each={rows()}>
          {(r) => (
            <div
              class={`${grid} ${row}`}
              data-member={r.name}
              data-match={r.match ?? undefined}
            >
              <div class={who}>
                <A href={`/people/${r.id}`}>{r.name}</A>
                <Show when={r.archived}>
                  <span class={role}> (archived)</span>
                </Show>
                <div class={role}>
                  {[
                    latestRole(r).role,
                    r.roles.length > 1 ? `+${r.roles.length - 1} more` : null,
                    r.match && r.match !== "self" ? OVERLAP_LABELS[r.match] : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Role not recorded"}
                </div>
              </div>
              <div class={track}>
                <For each={ticks()}>
                  {(y) => <span class={gridline} style={{ left: pct(`${y}-01-01`) }} />}
                </For>
                <For each={focusBands()}>
                  {(b) => (
                    <span
                      class={band}
                      style={{ left: pct(b.from), width: width(b.from, b.to) }}
                    />
                  )}
                </For>
                <For each={r.roles}>
                  {(a) => {
                    const s = span(a, today);
                    if (!s)
                      return <span class={undated}>{label(a)}</span>;
                    const tail =
                      s.tail === "unknown"
                        ? "6%"
                        : s.tail && s.tail > s.to
                          ? width(s.to, s.tail)
                          : null;
                    return (
                      <span
                        class={bar}
                        data-status={a.status}
                        data-tail={tail ? "" : undefined}
                        data-label={label(a)}
                        tabindex="0"
                        aria-label={`${r.name}: ${label(a)}`}
                        style={{
                          left: pct(s.from),
                          width: width(s.from, s.to),
                          "--tail": tail ?? "0",
                        }}
                      />
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </For>
        <div class={legend} aria-hidden="true">
          <span>
            <i class={css({ bg: "green.7" })} />
            Current
          </span>
          <span>
            <i class={css({ bg: "gray.8" })} />
            Ended
          </span>
          <span>
            <i class={css({ bg: "blue.5" })} />
            Status unknown
          </span>
          <span>- - - not seen since, or end unknown</span>
        </div>
      </div>
    </Show>
  );
}
