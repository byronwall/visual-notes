// The company timeline's data: one row per person, the year axis, and each
// role's bar in days. Pure, so the view stays about layout.
import {
  compareRoles,
  firstDay,
  lastDay,
  type OverlapKind,
} from "~/lib/people/career-periods";
import type { Affiliation, OrganizationDetail } from "~/lib/people/types";

type Member = OrganizationDetail["members"][number];
export type TimelineRow = {
  id: string;
  name: string;
  archived: boolean;
  roles: Affiliation[];
  /** How this person's time here compares with the focused person's. */
  match: OverlapKind | "self" | null;
};
export type Axis = { from: string; to: string; first: number; last: number };

const yearOf = (day: string) => Number(day.slice(0, 4));
export const dayNumber = (day: string) =>
  Date.parse(`${day}T00:00:00Z`) / 86_400_000;

/** People with their roles here; the focused person first, then most recent. */
export function buildRows(members: Member[], focusId: string | null) {
  const byPerson = new Map<string, TimelineRow>();
  for (const m of members) {
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
  const focus = list.find((r) => r.id === focusId);
  if (focus) {
    const rank: OverlapKind[] = ["overlap", "possible", "unknown", "none"];
    for (const r of list) {
      if (r === focus) {
        r.match = "self";
        continue;
      }
      const kinds = r.roles.flatMap((a) =>
        focus.roles.map((f) => compareRoles(f, a).kind),
      );
      r.match = rank.find((k) => kinds.includes(k)) ?? "none";
    }
  }
  const latest = (r: TimelineRow) =>
    r.roles.some((a) => a.status === "current")
      ? "9999"
      : r.roles
          .map((a) =>
            a.endOn ? lastDay(a.endOn) : a.startOn ? firstDay(a.startOn) : "",
          )
          .sort()
          .at(-1) ?? "";
  return list.sort(
    (a, b) =>
      Number(b.match === "self") - Number(a.match === "self") ||
      latest(b).localeCompare(latest(a)) ||
      a.name.localeCompare(b.name),
  );
}

/** First stated start through this year, or a later stated end. */
export function buildAxis(members: Member[], today: string): Axis | null {
  const roles = members.map((m) => m.affiliation);
  const starts = roles.flatMap((a) => (a.startOn ? [firstDay(a.startOn)] : []));
  if (!starts.length) return null;
  const first = yearOf(starts.sort()[0]);
  const ends = roles.flatMap((a) =>
    a.endOn ? [yearOf(lastDay(a.endOn))] : [],
  );
  const last = Math.max(yearOf(today), ...ends);
  return { from: `${first}-01-01`, to: `${last}-12-31`, first, last };
}

/** Position and size on the axis, as CSS percentages. */
export const at = (axis: Axis, day: string) =>
  `${((dayNumber(day) - dayNumber(axis.from)) / (dayNumber(axis.to) - dayNumber(axis.from))) * 100}%`;
export const across = (axis: Axis, from: string, to: string) =>
  `${((dayNumber(to) - dayNumber(from)) / (dayNumber(axis.to) - dayNumber(axis.from))) * 100}%`;
export const fraction = (axis: Axis, day: string) =>
  (dayNumber(day) - dayNumber(axis.from)) /
  (dayNumber(axis.to) - dayNumber(axis.from));

/** Labeled years: every 1, 2, 5, or 10 so labels stay ~44px apart. */
export function yearTicks(axis: Axis, trackPx: number): number[] {
  const years = axis.last - axis.first + 1;
  const perYear = trackPx / years;
  const step = [1, 2, 5, 10, 20].find((s) => s * perYear >= 44) ?? 50;
  const out: number[] = [];
  for (let y = axis.first; y <= axis.last; y += step) out.push(y);
  return out;
}

export type Bar = { from: string; to: string; tail: string | "unknown" | null };

/**
 * A role's bar in days, or null with no start. A current role is solid to
 * the day it was last seen, dashed after; an end that is not known is a
 * sliver with a dashed "?" tail.
 */
export function roleBar(a: Affiliation, today: string): Bar | null {
  if (!a.startOn) return null;
  const from = firstDay(a.startOn);
  if (a.endOn) return { from, to: lastDay(a.endOn), tail: null };
  if (a.status === "current") {
    const seen = a.observedOn ?? a.recordedOn;
    return { from, to: seen < from ? from : seen, tail: today };
  }
  return { from, to: from, tail: "unknown" };
}
