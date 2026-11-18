import type {
  CollectionProperty,
  CollectionRow,
  PropertyValue,
} from "~/lib/collections/types";
import { EVENT_PROPERTY_PREFIX } from "~/lib/collections/types";
import { DECISION_COLORS } from "~/lib/events/filters";
import { instantToWallClock } from "~/lib/events/time";
import {
  DECISION_LABELS,
  EVENT_DECISIONS,
  effectiveDecision,
  type EventDecision,
} from "~/lib/events/types";
import { prisma } from "~/server/db";

const id = (key: string) => `${EVENT_PROPERTY_PREFIX}${key}`;
export const EVENT_COLUMN_IDS = {
  next: id("next"),
  place: id("place"),
  decision: id("decision"),
  shows: id("shows"),
  link: id("link"),
} as const;

type Show = {
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  timeConfirmed: boolean;
  timeZone: string;
  decision: EventDecision;
  place: { name: string } | null;
};

/** Wall-clock date value; a time only when the show has a confirmed one. */
function showDate(show: Show) {
  const start = instantToWallClock(show.startsAt, show.timeZone);
  const timed = show.timeConfirmed && !show.allDay;
  const end = show.endsAt
    ? instantToWallClock(show.endsAt, show.timeZone)
    : null;
  return {
    start: timed ? `${start.date}T${start.time}` : start.date,
    end: end && end.date !== start.date ? end.date : null,
  };
}

/**
 * Event columns for a set of rows: the next show (else the latest past one),
 * its place and decision, the show count, and the event link. Returns no
 * properties when no row is an event, so plain collections are unchanged.
 */
export async function loadEventColumns(
  docIds: string[],
  after: CollectionProperty[],
  now = new Date(),
): Promise<{
  properties: CollectionProperty[];
  values: Map<string, Record<string, PropertyValue>>;
}> {
  const values = new Map<string, Record<string, PropertyValue>>();
  if (!docIds.length) return { properties: [], values };
  const events = await prisma.event.findMany({
    where: { docId: { in: docIds } },
    select: {
      docId: true,
      url: true,
      decision: true,
      place: { select: { name: true } },
      occurrences: {
        where: { status: { not: "cancelled" } },
        orderBy: { startsAt: "asc" },
        select: {
          startsAt: true,
          endsAt: true,
          allDay: true,
          timeConfirmed: true,
          timeZone: true,
          decision: true,
          place: { select: { name: true } },
        },
      },
    },
  });
  if (!events.length) return { properties: [], values };

  let multi = false;
  let links = false;
  for (const e of events) {
    const shows = e.occurrences;
    const show =
      shows.find((s) => (s.endsAt ?? s.startsAt) >= now) ?? shows.at(-1);
    multi ||= shows.length > 1;
    links ||= Boolean(e.url);
    values.set(e.docId, {
      [EVENT_COLUMN_IDS.next]: show ? showDate(show) : null,
      [EVENT_COLUMN_IDS.place]: (show?.place ?? e.place)?.name ?? null,
      [EVENT_COLUMN_IDS.decision]: show
        ? effectiveDecision(show.decision, e.decision)
        : e.decision,
      [EVENT_COLUMN_IDS.shows]: shows.length,
      [EVENT_COLUMN_IDS.link]: e.url ?? null,
    });
  }

  const base = Math.max(0, ...after.map((p) => p.position)) + 1;
  const column = (
    key: keyof typeof EVENT_COLUMN_IDS,
    name: string,
    rest: Pick<CollectionProperty, "kind" | "config">,
  ): CollectionProperty => ({
    id: EVENT_COLUMN_IDS[key],
    name,
    position: base + Object.keys(EVENT_COLUMN_IDS).indexOf(key),
    ...rest,
  });
  const properties = [
    column("next", "Next show", {
      kind: "date",
      config: { includeTime: true },
    }),
    column("place", "Place", { kind: "text", config: {} }),
    column("decision", "Decision", {
      kind: "select",
      config: {
        options: EVENT_DECISIONS.map((d) => ({
          id: d,
          name: DECISION_LABELS[d],
          color: DECISION_COLORS[d],
        })),
      },
    }),
    ...(multi
      ? [column("shows", "Shows", { kind: "number", config: {} })]
      : []),
    ...(links
      ? [
          column("link", "Event link", {
            kind: "text",
            config: { format: "url" },
          }),
        ]
      : []),
  ];
  return { properties, values };
}

/** Adds event columns to loaded rows in place; returns the extra properties. */
export async function withEventColumns(
  rows: CollectionRow[],
  properties: CollectionProperty[],
) {
  const extra = await loadEventColumns(
    rows.map((r) => r.id),
    properties,
  );
  for (const row of rows) {
    const v = extra.values.get(row.id);
    if (v) row.properties = { ...row.properties, ...v };
  }
  return extra.properties;
}
