// Employment periods with honest precision. A role's dates are partial ISO
// strings (YYYY, YYYY-MM, YYYY-MM-DD) and its status (current, ended,
// unknown) is independent of its end date. Comparison bounds are derived
// here as calendar days and never shown as employment dates.
import { addDays } from "./dates";

export const AFFILIATION_KINDS = ["employment", "membership"] as const;
export type AffiliationKind = (typeof AFFILIATION_KINDS)[number];

export const ROLE_STATUSES = ["current", "ended", "unknown"] as const;
export type RoleStatus = (typeof ROLE_STATUSES)[number];

export const ROLE_STATUS_LABELS: Record<RoleStatus, string> = {
  current: "Current",
  ended: "Ended",
  unknown: "Status unknown",
};

const PARTIAL = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export type Precision = "year" | "month" | "day";

/** True for YYYY, YYYY-MM, or a real YYYY-MM-DD. */
export function isPartialDate(value: string): boolean {
  const m = PARTIAL.exec(value);
  if (!m) return false;
  const month = m[2] ? Number(m[2]) : 1;
  if (month < 1 || month > 12) return false;
  if (!m[3]) return true;
  return lastDay(`${m[1]}-${m[2]}`) >= value && Number(m[3]) >= 1;
}

export const precisionOf = (value: string): Precision =>
  value.length === 4 ? "year" : value.length === 7 ? "month" : "day";

/** The first calendar day the partial date can mean. */
export function firstDay(value: string): string {
  if (value.length === 4) return `${value}-01-01`;
  if (value.length === 7) return `${value}-01`;
  return value;
}

/** The last calendar day the partial date can mean. */
export function lastDay(value: string): string {
  if (value.length === 4) return `${value}-12-31`;
  if (value.length === 7) {
    const [y, m] = value.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
    return addDays(next, -1);
  }
  return value;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Moves a partial date by whole units of its own precision. */
function shift(value: string, units: number): string {
  const p = precisionOf(value);
  if (p === "year") return String(Number(value) + units);
  if (p === "day") return addDays(value, units);
  const [y, m] = value.split("-").map(Number);
  const total = y * 12 + (m - 1) + units;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Earliest and latest day a stated endpoint can mean; approx widens one unit. */
function range(value: string, approx: boolean): [string, string] {
  return approx
    ? [firstDay(shift(value, -1)), lastDay(shift(value, 1))]
    : [firstDay(value), lastDay(value)];
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2011", "Jul 2011", or "Jul 4, 2011"; "c. " marks an approximate value. */
export function formatPartial(value: string, approx = false): string {
  const [y, m, d] = value.split("-");
  const text = !m
    ? y
    : !d
      ? `${MONTHS[Number(m) - 1]} ${y}`
      : `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
  return approx ? `c. ${text}` : text;
}

export type RolePeriod = {
  status: RoleStatus;
  startOn: string | null;
  startApprox: boolean;
  endOn: string | null;
  endApprox: boolean;
  /** The day a source last showed this role; limits a current claim. */
  observedOn: string | null;
};

/** "Jul 2011 – Mar 2014", "Jul 2011 – present", "Dates unknown". */
export function formatPeriod(p: RolePeriod): string {
  const from = p.startOn ? formatPartial(p.startOn, p.startApprox) : null;
  const to = p.endOn
    ? formatPartial(p.endOn, p.endApprox)
    : p.status === "current"
      ? "present"
      : p.status === "ended"
        ? "end unknown"
        : null;
  if (!from && !to) return "Dates unknown";
  if (!from) return p.endOn ? `Until ${to}` : `${to![0].toUpperCase()}${to!.slice(1)}`;
  return `${from} – ${to ?? "?"}`;
}

/**
 * "2 yrs 2 mos" between a stated start and end month, counted inclusively as
 * LinkedIn does. Null when either end is missing, approximate, or only a
 * year: a guessed length would read as fact.
 */
export function durationLabel(p: RolePeriod): string | null {
  if (!p.startOn || !p.endOn || p.startApprox || p.endApprox) return null;
  if (precisionOf(p.startOn) === "year" || precisionOf(p.endOn) === "year")
    return null;
  const [sy, sm] = p.startOn.split("-").map(Number);
  const [ey, em] = p.endOn.split("-").map(Number);
  const months = (ey - sy) * 12 + (em - sm) + 1;
  if (months < 1) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const part = (n: number, unit: string) =>
    n ? `${n} ${unit}${n === 1 ? "" : "s"}` : "";
  return [part(y, "yr"), part(m, "mo")].filter(Boolean).join(" ");
}

/**
 * One span for several roles at one employer: earliest stated start to the
 * latest stated end, or "present" when one is current. Null when any role is
 * missing the date the span needs.
 */
export function groupSpan(list: RolePeriod[]): string | null {
  if (list.some((p) => !p.startOn)) return null;
  const first = [...list].sort((a, b) =>
    firstDay(a.startOn!).localeCompare(firstDay(b.startOn!)),
  )[0];
  const from = formatPartial(first.startOn!, first.startApprox);
  if (list.some((p) => p.status === "current")) return `${from} – present`;
  if (list.some((p) => !p.endOn)) return null;
  const last = [...list].sort((a, b) =>
    lastDay(b.endOn!).localeCompare(lastDay(a.endOn!)),
  )[0];
  return `${from} – ${formatPartial(last.endOn!, last.endApprox)}`;
}

/** A short status note when the dates alone could mislead. */
export function statusNote(p: RolePeriod): string | null {
  if (p.status === "unknown") return "Status unknown";
  if (p.status === "current" && p.observedOn)
    return `Current as of ${formatPartial(p.observedOn)}`;
  return null;
}

/** Sort key: newest start first, undated roles last. */
export const startKey = (p: RolePeriod) => (p.startOn ? firstDay(p.startOn) : "");

/** Stated end dates must not come before stated starts. */
export function periodProblem(p: {
  status?: RoleStatus;
  startOn?: string | null;
  endOn?: string | null;
}): string | null {
  if (p.startOn && p.endOn && lastDay(p.endOn) < firstDay(p.startOn))
    return "A role cannot end before it starts";
  if (p.status === "current" && p.endOn)
    return "A current role has no end date; mark it ended to record one";
  return null;
}

// ------------------------------------------------------------- overlap

export const OVERLAP_KINDS = ["overlap", "possible", "none", "unknown"] as const;
export type OverlapKind = (typeof OVERLAP_KINDS)[number];

export type Overlap = {
  kind: OverlapKind;
  /** Later stated start of the two, as written on the role. */
  from: string | null;
  /** Earlier stated end (or current-as-of day), as written on the role. */
  to: string | null;
  note: string;
};

type Span = [string, string];
type Bounds = {
  /** Days the role certainly covered, when known. */
  sure: Span | null;
  /** Ranges that each certainly contain at least one active day. */
  points: Span[];
  /** Widest days the role could have covered; null ends are open. */
  maybe: [string | null, string | null];
  dated: boolean;
};

function bounds(p: RolePeriod, recordedOn: string): Bounds {
  const start = p.startOn ? range(p.startOn, p.startApprox) : null;
  const ended = p.status === "ended" || !!p.endOn;
  const end = p.endOn ? range(p.endOn, p.endApprox) : null;
  // A current claim holds through the day it was seen, and no further.
  const seen = p.status === "current" ? (p.observedOn ?? recordedOn) : null;
  const sureStart = start?.[1] ?? seen;
  const sureEnd = end?.[0] ?? seen;
  const sure: Span | null =
    sureStart && sureEnd && sureStart <= sureEnd ? [sureStart, sureEnd] : null;
  const points: Span[] = [];
  if (start) points.push(start);
  if (end) points.push(end);
  if (seen) points.push([seen, seen]);
  // An ended role without an end day ended before it was last recorded.
  const lastPossible = end?.[1] ?? (ended ? (p.observedOn ?? null) : null);
  return {
    sure,
    points,
    maybe: [start?.[0] ?? null, lastPossible],
    dated: !!(p.startOn || p.endOn),
  };
}

const within = (inner: Span, outer: Span) =>
  inner[0] >= outer[0] && inner[1] <= outer[1];

/**
 * Compares two roles at the same organization. "overlap" means the stated
 * evidence puts both people there on a shared day; "possible" means the
 * periods could touch but the dates are too coarse to say; "none" means the
 * stated periods are apart; "unknown" means one role has no dates.
 */
export function compareRoles(
  a: RolePeriod & { recordedOn: string },
  b: RolePeriod & { recordedOn: string },
): Overlap {
  const A = bounds(a, a.recordedOn);
  const B = bounds(b, b.recordedOn);
  const [from, to] = sharedLabels(a, b);
  const span = from || to ? `${from ?? "?"} – ${to ?? "?"}` : "";

  const apart =
    (A.maybe[1] && B.maybe[0] && A.maybe[1] < B.maybe[0]) ||
    (B.maybe[1] && A.maybe[0] && B.maybe[1] < A.maybe[0]);
  if (apart)
    return { kind: "none", from: null, to: null, note: "Their periods there do not overlap." };

  const sureShared =
    (A.sure && B.sure && A.sure[0] <= B.sure[1] && B.sure[0] <= A.sure[1]) ||
    (A.sure && B.points.some((pt) => within(pt, A.sure!))) ||
    (B.sure && A.points.some((pt) => within(pt, B.sure!)));
  if (sureShared)
    return {
      kind: "overlap",
      from,
      to,
      note: `Both worked there ${span || "at the same time"}.`,
    };

  if (!A.dated || !B.dated)
    return {
      kind: "unknown",
      from: null,
      to: null,
      note: "Same organization, but the dates are insufficient to compare.",
    };
  return {
    kind: "possible",
    from,
    to,
    note: `Their periods may overlap${span ? ` around ${span}` : ""}; the stated dates are too coarse to confirm.`,
  };
}

/** The later stated start and the earlier stated end, in their own precision. */
function sharedLabels(a: RolePeriod, b: RolePeriod): [string | null, string | null] {
  const starts = [a, b].filter((p) => p.startOn);
  const later = starts.sort((x, y) =>
    lastDay(y.startOn!).localeCompare(lastDay(x.startOn!)),
  )[0];
  const endOf = (p: RolePeriod) =>
    p.endOn
      ? { key: firstDay(p.endOn), label: formatPartial(p.endOn, p.endApprox) }
      : p.status === "current" && p.observedOn
        ? { key: p.observedOn, label: `${formatPartial(p.observedOn)} (last seen)` }
        : p.status === "current"
          ? { key: "9999", label: "present" }
          : null;
  const ends = [a, b].map(endOf).filter((e) => e != null);
  const earlier = ends.sort((x, y) => x.key.localeCompare(y.key))[0];
  return [
    later ? formatPartial(later.startOn!, later.startApprox) : null,
    ends.length === 2 ? earlier.label : null,
  ];
}
