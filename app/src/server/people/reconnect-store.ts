// Reasons to reconnect. Elapsed-time suggestions come from a per-person,
// opt-in cadence and are computed on read; only the user's actions on them
// are stored. Contextual prompts are stored when created. Snoozing,
// dismissing, or resolving never counts as contact; logging a real encounter
// moves the due day, which retires the old suggestion.
import {
  addDays,
  dayToDb,
  dbToDay,
  formatDay,
  todayLocal,
} from "~/lib/people/dates";
import { prisma } from "~/server/db";
import { PeopleInputError, withRequestKey } from "./errors";
import type { Db } from "./profile-store";
import { lastContactByPerson } from "./recency";

export type FollowupStatus = "pending" | "snoozed" | "dismissed" | "resolved";

export type Followup = {
  key: string;
  id: string | null;
  kind: "elapsed" | "contextual";
  person: { id: string; displayName: string; currentRole?: string | null };
  reason: string;
  suggestedOn: string;
  status: FollowupStatus;
  snoozedUntil: string | null;
  lastContactOn: string | null;
  source: {
    factId: string | null;
    interactionId: string | null;
    text: string | null;
  };
};

export const elapsedKey = (personId: string, due: string) =>
  `elapsed:${personId}:${due}`;

const cadenceLabel = (days: number) =>
  days % 365 === 0
    ? `every ${days / 365 === 1 ? "year" : `${days / 365} years`}`
    : days % 30 === 0
      ? `every ${days / 30 === 1 ? "month" : `${days / 30} months`}`
      : `every ${days} days`;

/** Elapsed-time suggestions for every opted-in, active person, due by `until`. */
async function elapsedCandidates(today: string, until: string) {
  const people = await prisma.person.findMany({
    where: { archivedAt: null, reconnectEveryDays: { not: null } },
    select: {
      id: true,
      displayName: true,
      reconnectEveryDays: true,
      reconnectSince: true,
    },
  });
  const last = await lastContactByPerson(people.map((p) => p.id));
  const out: Followup[] = [];
  for (const p of people) {
    const lastOn = last.get(p.id) ?? null;
    const start =
      lastOn ?? (p.reconnectSince ? dbToDay(p.reconnectSince) : today);
    const due = addDays(start, p.reconnectEveryDays!);
    if (due > until) continue;
    out.push({
      key: elapsedKey(p.id, due),
      id: null,
      kind: "elapsed",
      person: { id: p.id, displayName: p.displayName },
      reason: lastOn
        ? `Last contact ${formatDay(lastOn)}; you asked to reconnect ${cadenceLabel(p.reconnectEveryDays!)}`
        : `No recorded contact since you set reconnect ${cadenceLabel(p.reconnectEveryDays!)}`,
      suggestedOn: due,
      status: "pending",
      snoozedUntil: null,
      lastContactOn: lastOn,
      source: { factId: null, interactionId: null, text: null },
    });
  }
  return out;
}

/**
 * The queue: due elapsed suggestions merged with their stored state, plus
 * contextual prompts. `include` picks which states to return.
 */
export async function listFollowups(
  opts: {
    today?: string;
    /** Also return items due within this many days. */
    upcomingDays?: number;
    include?: FollowupStatus[];
    personId?: string;
  } = {},
): Promise<Followup[]> {
  const today = opts.today ?? todayLocal();
  const until = addDays(today, opts.upcomingDays ?? 0);
  const include = new Set(opts.include ?? ["pending"]);
  const computed = await elapsedCandidates(today, until);
  const stored = await prisma.peopleReconnect.findMany({
    where: {
      person: { archivedAt: null },
      ...(opts.personId ? { personId: opts.personId } : {}),
    },
    include: { person: { select: { id: true, displayName: true } } },
  });
  const byKey = new Map(stored.map((r) => [r.key, r]));
  // A stored elapsed state for an older due day was replaced by a newer
  // contact or cadence: record it as resolved so it never comes back.
  const current = new Set(computed.map((c) => c.key));
  const stale = stored.filter(
    (r) =>
      r.kind === "elapsed" &&
      !current.has(r.key) &&
      (r.status === "pending" || r.status === "snoozed") &&
      dbToDay(r.suggestedOn) <= until,
  );
  if (stale.length) {
    await prisma.peopleReconnect.updateMany({
      where: { id: { in: stale.map((r) => r.id) } },
      data: { status: "resolved", resolvedAt: new Date(), snoozedUntil: null },
    });
  }
  const facts = await prisma.personFact.findMany({
    where: {
      id: {
        in: stored.map((r) => r.sourceFactId).filter((x): x is string => !!x),
      },
    },
    select: { id: true, text: true },
  });
  const factText = new Map(facts.map((f) => [f.id, f.text]));
  const last = await lastContactByPerson([
    ...new Set(stored.map((r) => r.personId)),
  ]);

  const items: Followup[] = [];
  for (const c of computed) {
    if (opts.personId && c.person.id !== opts.personId) continue;
    const state = byKey.get(c.key);
    items.push(
      state
        ? {
            ...c,
            id: state.id,
            status: state.status,
            snoozedUntil: state.snoozedUntil
              ? dbToDay(state.snoozedUntil)
              : null,
          }
        : c,
    );
  }
  for (const r of stored) {
    if (r.kind !== "contextual") continue;
    items.push({
      key: r.key,
      id: r.id,
      kind: "contextual",
      person: r.person,
      reason: r.reason,
      suggestedOn: dbToDay(r.suggestedOn),
      status: r.status,
      snoozedUntil: r.snoozedUntil ? dbToDay(r.snoozedUntil) : null,
      lastContactOn: last.get(r.personId) ?? null,
      source: {
        factId: r.sourceFactId,
        interactionId: r.sourceInteractionId,
        text: r.sourceFactId ? factText.get(r.sourceFactId) ?? null : null,
      },
    });
  }
  // A snooze that has run out makes the item pending again.
  for (const i of items) {
    if (i.status === "snoozed" && i.snoozedUntil && i.snoozedUntil <= today) {
      i.status = "pending";
    }
  }
  return items
    .filter((i) => include.has(i.status))
    .filter((i) => i.status !== "pending" || i.suggestedOn <= until)
    .sort(
      (a, b) =>
        a.suggestedOn.localeCompare(b.suggestedOn) ||
        a.person.displayName.localeCompare(b.person.displayName),
    );
}

/** Creates an explicit reason to reconnect, e.g. "Ask how the move went". */
export async function addFollowup(input: {
  personId: string;
  reason: string;
  suggestedOn?: string;
  sourceFactId?: string | null;
  sourceInteractionId?: string | null;
  requestKey?: string;
}) {
  const reason = input.reason.trim();
  if (!reason) throw new PeopleInputError("Write a reason to reconnect");
  const person = await prisma.person.findUnique({
    where: { id: input.personId },
  });
  if (!person)
    throw new PeopleInputError(
      `Person not found: ${input.personId}`,
      "not_found",
    );
  const key = input.requestKey
    ? `ctx:key:${input.requestKey}`
    : `ctx:${crypto.randomUUID()}`;
  const { record, existing } = await withRequestKey(
    input.requestKey ? key : undefined,
    (k) => prisma.peopleReconnect.findUnique({ where: { key: k } }),
    () =>
      prisma.peopleReconnect.create({
        data: {
          personId: input.personId,
          key,
          kind: "contextual",
          reason,
          suggestedOn: dayToDb(input.suggestedOn ?? todayLocal()),
          sourceFactId: input.sourceFactId || null,
          sourceInteractionId: input.sourceInteractionId || null,
        },
      }),
  );
  console.info(
    `[people] ${existing ? "reused" : "added"} reconnect prompt`,
    record.id,
  );
  return { id: record.id, key: record.key, existing };
}

export type FollowupAction = "snooze" | "dismiss" | "resolve" | "reopen";

/**
 * Acts on one item by its key. An elapsed suggestion gets a stored state
 * record the first time; the state sticks to that due day only.
 */
export async function updateFollowup(input: {
  key: string;
  action: FollowupAction;
  snoozedUntil?: string;
  reason?: string;
  suggestedOn?: string;
  today?: string;
}) {
  const today = input.today ?? todayLocal();
  const status: FollowupStatus =
    input.action === "snooze"
      ? "snoozed"
      : input.action === "dismiss"
        ? "dismissed"
        : input.action === "resolve"
          ? "resolved"
          : "pending";
  if (
    status === "snoozed" &&
    !(input.snoozedUntil && input.snoozedUntil > today)
  ) {
    throw new PeopleInputError("Snooze needs a day after today");
  }
  const data = {
    status,
    snoozedUntil: status === "snoozed" ? dayToDb(input.snoozedUntil!) : null,
    resolvedAt: status === "resolved" ? new Date() : null,
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
    ...(input.suggestedOn ? { suggestedOn: dayToDb(input.suggestedOn) } : {}),
  };
  const existing = await prisma.peopleReconnect.findUnique({
    where: { key: input.key },
  });
  if (existing) {
    await prisma.peopleReconnect.update({ where: { key: input.key }, data });
  } else {
    const m = /^elapsed:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(input.key);
    if (!m)
      throw new PeopleInputError(
        `Reconnect item not found: ${input.key}`,
        "not_found",
      );
    const [, personId, due] = m;
    const current = (await elapsedCandidates(today, addDays(today, 3650))).find(
      (c) => c.key === input.key,
    );
    if (!current) {
      throw new PeopleInputError(
        "That suggestion is no longer current; a newer contact or cadence replaced it",
      );
    }
    await prisma.peopleReconnect.create({
      data: {
        personId,
        key: input.key,
        kind: "elapsed",
        reason: current.reason,
        suggestedOn: dayToDb(due),
        ...data,
      },
    });
  }
  console.info(`[people] reconnect ${input.action}`, input.key);
  return { key: input.key, status };
}

/** Turns the opt-in cadence on (days) or off (null) for one person. */
export async function setReconnectCadence(
  personId: string,
  days: number | null,
  today = todayLocal(),
  db: Db = prisma,
) {
  if (days != null && (!Number.isInteger(days) || days < 7 || days > 3650)) {
    throw new PeopleInputError("Use a cadence between 7 and 3650 days");
  }
  await db.person.update({
    where: { id: personId },
    data: {
      reconnectEveryDays: days,
      reconnectSince: days == null ? null : dayToDb(today),
    },
  });
}

/** A plain-text digest of the due queue, with links, for agents or a copy. */
export function followupDigest(
  items: Followup[],
  origin: string,
  today = todayLocal(),
) {
  if (!items.length)
    return `Nothing to follow up on as of ${formatDay(today)}.`;
  const lines = items.map(
    (i) =>
      `- ${i.person.displayName}: ${i.reason}${i.source.text ? ` (${i.source.text})` : ""} — ${origin}/people/${i.person.id}`,
  );
  return [`Reasons to reconnect, ${formatDay(today)}:`, ...lines].join("\n");
}
