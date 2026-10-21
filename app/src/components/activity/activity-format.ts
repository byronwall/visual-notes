import type { ActionEventItem } from "~/services/activity/activity.types";

export type ActivityDomain =
  | "doc"
  | "research"
  | "task"
  | "collection"
  | "time_block"
  | "event"
  | "archive"
  | "search"
  | "ai"
  | "admin"
  | "other";

export const ACTIVITY_DOMAINS: {
  value: ActivityDomain | "all";
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "doc", label: "Notes" },
  { value: "research", label: "Research" },
  { value: "task", label: "Tasks" },
  { value: "collection", label: "Collections" },
  { value: "time_block", label: "Calendar" },
  { value: "event", label: "Events" },
  { value: "archive", label: "Archive" },
  { value: "search", label: "Search" },
  { value: "ai", label: "AI" },
  { value: "admin", label: "Admin" },
];

export type ActivityDescription = {
  domain: ActivityDomain;
  verb: string;
  /** Note title shown as the link target, when the event has one. */
  docTitle: string | null;
  docHref: string | null;
  /** Secondary detail in plain words (query, counts, model). */
  detail: string | null;
  /** Link for events that point somewhere other than a note. */
  href: string | null;
  tone: "default" | "danger";
  /** Who did it, when it was not you in the app (an agent or the API). */
  via: string | null;
};

const str = (payload: ActionEventItem["payload"], key: string) => {
  const value = payload?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
};

const num = (payload: ActionEventItem["payload"], key: string) => {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

export const activityDomainOf = (eventType: string): ActivityDomain => {
  const domain = eventType.split(".")[0];
  if (domain === "task" || domain === "task_list") return "task";
  if (domain === "collection") return "collection";
  if (domain === "time_block" || domain === "time_block_day")
    return "time_block";
  if (domain === "archive") return "archive";
  if (domain === "event") return "event";
  if (
    domain === "doc" ||
    domain === "research" ||
    domain === "search" ||
    domain === "ai" ||
    domain === "admin"
  ) {
    return domain;
  }
  return "other";
};

const humanizeEventType = (eventType: string) => {
  const words = eventType.replace(/[._]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const quote = (value: string) => `“${value}”`;

/** "Claude Code", "ChatGPT", or the API caller for non-user events. */
const viaOf = (event: ActionEventItem): string | null => {
  const agent = str(event.payload, "agent");
  if (agent && agent !== "you") return agent;
  if (event.actorType === "chatgpt") {
    const id = event.actorId ?? "";
    return id.startsWith("chatgpt") || !id ? "ChatGPT" : id;
  }
  if (event.actorType === "system" && event.actorId?.startsWith("research-api"))
    return "research API";
  return null;
};

const BATCH_VERBS: Record<string, string> = {
  ingest: "Added research to",
  link: "Linked cards in",
  state: "Changed card states in",
  edit: "Edited cards in",
  remove: "Removed cards from",
};

const describeTask = (
  event: ActionEventItem,
  base: ActivityDescription,
): ActivityDescription => {
  const payload = event.payload;
  const task = {
    ...base,
    docTitle: str(payload, "description") ?? str(payload, "name"),
    docHref: "/tasks",
  };
  const list = str(payload, "list");
  switch (event.eventType) {
    case "task.created":
      return {
        ...task,
        verb: "Added task",
        detail: list ? `to ${list}` : null,
      };
    case "task.updated": {
      const status = str(payload, "status");
      return { ...task, verb: status ? `Marked ${status}` : "Updated task" };
    }
    case "task.moved":
      return {
        ...task,
        verb: "Moved task",
        detail: list ? `to ${list}` : null,
      };
    case "task_list.created":
      return { ...task, verb: "Created task list" };
    case "task_list.renamed":
      return {
        ...task,
        verb: "Renamed task list",
        detail: str(payload, "previousName")
          ? `from ${quote(str(payload, "previousName")!)}`
          : null,
      };
    default:
      return task;
  }
};

const COLLECTION_VERBS: Record<string, string> = {
  "collection.created": "Created collection",
  "collection.updated": "Renamed collection",
  "collection.property_added": "Added a property to",
  "collection.property_updated": "Changed a property in",
  "collection.row_added": "Added a row to",
  "collection.rows_updated": "Updated rows in",
  "collection.notes_added": "Added notes to",
  "collection.notes_removed": "Removed notes from",
  "collection.view_created": "Created a view in",
};

const describeCollection = (
  event: ActionEventItem,
  base: ActivityDescription,
): ActivityDescription => {
  const payload = event.payload;
  const rows = num(payload, "rowCount");
  return {
    ...base,
    verb: COLLECTION_VERBS[event.eventType] ?? base.verb,
    docTitle: str(payload, "collectionName"),
    docHref: event.entityId ? `/collections/${event.entityId}` : null,
    detail:
      str(payload, "rowTitle") ??
      str(payload, "property") ??
      str(payload, "view") ??
      (rows ? plural(rows, "row") : null),
  };
};

const describeTimeBlock = (
  event: ActionEventItem,
  base: ActivityDescription,
): ActivityDescription => {
  const payload = event.payload;
  const calendar = { ...base, docHref: "/time-blocks" };
  switch (event.eventType) {
    case "time_block.created":
      return {
        ...calendar,
        verb: "Planned",
        docTitle: str(payload, "title"),
        detail: str(payload, "day"),
      };
    case "time_block.updated":
      return {
        ...calendar,
        verb: "Changed time block",
        docTitle: str(payload, "title"),
        detail: str(payload, "day"),
      };
    case "time_block_day.set": {
      const key = str(payload, "key");
      return {
        ...calendar,
        verb: "Set day value",
        docTitle: key,
        detail: str(payload, "day"),
      };
    }
    default:
      return calendar;
  }
};

const describeArchive = (
  event: ActionEventItem,
  base: ActivityDescription,
): ActivityDescription => {
  const payload = event.payload;
  const archive = {
    ...base,
    docTitle: str(payload, "pageTitle"),
    docHref: event.entityId
      ? `/archive?item=${encodeURIComponent(event.entityId)}`
      : "/archive",
  };
  if (event.eventType === "archive.note_added")
    return { ...archive, verb: "Added a note to" };
  return archive;
};

const EVENT_VERBS: Record<string, string> = {
  "event.created": "Added event",
  "event.updated": "Updated event",
  "event.shows_added": "Added shows to",
  "event.show_updated": "Changed a show of",
  "event.place_created": "Added place",
  "event.place_updated": "Updated place",
};

const describeEvent = (
  event: ActionEventItem,
  base: ActivityDescription,
): ActivityDescription => {
  const payload = event.payload;
  const isPlace = event.eventType.startsWith("event.place");
  const shows = num(payload, "showCount");
  return {
    ...base,
    verb: EVENT_VERBS[event.eventType] ?? base.verb,
    docTitle: isPlace ? str(payload, "name") : base.docTitle,
    docHref: isPlace ? "/events/places" : base.docHref,
    detail: isPlace
      ? str(payload, "city")
      : shows
        ? plural(shows, "show")
        : str(payload, "decision"),
  };
};

const describeResearch = (
  event: ActionEventItem,
  base: ActivityDescription,
): ActivityDescription => {
  const payload = event.payload;
  const slug = str(payload, "topicSlug");
  const topic = {
    ...base,
    docTitle: str(payload, "topicTitle"),
    docHref: slug ? `/research/${slug}` : null,
  };
  const summary = str(payload, "summary");
  const cards = num(payload, "cardCount");
  switch (event.eventType) {
    case "research.topic_created":
      return { ...topic, verb: "Created research topic" };
    case "research.topic_updated": {
      const change = str(payload, "change") ?? "updated";
      return {
        ...topic,
        verb: `${change.charAt(0).toUpperCase()}${change.slice(1)} research topic`,
      };
    }
    case "research.batch_added": {
      const kind = str(payload, "kind") ?? "ingest";
      return {
        ...topic,
        verb: BATCH_VERBS[kind] ?? "Changed",
        detail:
          [
            summary ? quote(summary) : null,
            cards ? plural(cards, "card") : null,
          ]
            .filter(Boolean)
            .join(" · ") || null,
        tone: kind === "remove" ? "danger" : "default",
      };
    }
    case "research.batch_undone":
      return {
        ...topic,
        verb: "Undid a batch in",
        detail: summary ? quote(summary) : null,
      };
    case "research.batch_redone":
      return {
        ...topic,
        verb: "Redid a batch in",
        detail: summary ? quote(summary) : null,
      };
    default:
      return topic;
  }
};

export const describeActivityEvent = (
  event: ActionEventItem,
): ActivityDescription => {
  const payload = event.payload;
  const domain = activityDomainOf(event.eventType);
  const docTitle =
    event.relatedDocTitle ?? str(payload, "docTitle") ?? str(payload, "title");
  const docHref = event.relatedDocId ? `/docs/${event.relatedDocId}` : null;
  const base: ActivityDescription = {
    domain,
    verb: humanizeEventType(event.eventType),
    docTitle: docTitle ?? null,
    docHref,
    detail: null,
    href: null,
    tone: "default",
    via: viaOf(event),
  };
  const query = str(payload, "queryPreview") ?? str(payload, "queryText");
  if (domain === "research") return describeResearch(event, base);
  if (domain === "task") return describeTask(event, base);
  if (domain === "collection") return describeCollection(event, base);
  if (domain === "time_block") return describeTimeBlock(event, base);
  if (domain === "archive") return describeArchive(event, base);
  if (domain === "event") return describeEvent(event, base);

  switch (event.eventType) {
    case "doc.view":
      return { ...base, verb: "Viewed" };
    case "doc.create":
      return { ...base, verb: "Created" };
    case "doc.delete":
      return { ...base, verb: "Deleted", docHref: null, tone: "danger" };
    case "doc.update": {
      const fields = Array.isArray(payload?.fieldsChanged)
        ? (payload.fieldsChanged as unknown[]).map(String)
        : [];
      const onlyMeta =
        fields.length > 0 &&
        fields.every((f) => f === "title" || f === "path" || f === "meta");
      if (fields.length === 1 && fields[0] === "title")
        return { ...base, verb: "Renamed" };
      if (fields.length === 1 && fields[0] === "path")
        return { ...base, verb: "Moved" };
      return { ...base, verb: onlyMeta ? "Updated details of" : "Edited" };
    }
    case "doc.bulk_delete": {
      const count = num(payload, "deletedCount") ?? 0;
      return {
        ...base,
        verb: `Deleted ${plural(count, "note")}`,
        tone: "danger",
      };
    }
    case "doc.bulk_update_meta": {
      const count = num(payload, "updatedCount") ?? 0;
      return { ...base, verb: `Updated ${plural(count, "note")}` };
    }
    case "search.query.executed": {
      const results = num(payload, "resultCount");
      return {
        ...base,
        verb: "Searched",
        detail:
          [
            query ? quote(query) : null,
            results === null ? null : plural(results, "result"),
          ]
            .filter(Boolean)
            .join(" · ") || null,
      };
    }
    case "search.result.opened":
      return {
        ...base,
        verb: "Opened",
        detail: query ? `from search ${quote(query)}` : "from search",
      };
    case "ai.prompt.run_started":
      return { ...base, verb: "Started a prompt run" };
    case "ai.prompt.run_finished": {
      const failed = str(payload, "status") === "ERROR";
      return {
        ...base,
        verb: failed ? "Prompt run failed" : "Prompt run finished",
        detail: str(payload, "model"),
        href:
          event.entityType === "prompt_run" && event.entityId
            ? `/ai/runs/${event.entityId}`
            : null,
        tone: failed ? "danger" : "default",
      };
    }
    case "ai.chat.thread_created":
      return { ...base, verb: "Started a chat" };
    case "ai.chat.message_sent":
      return { ...base, verb: "Sent a chat message" };
    case "admin.inline_image_migration.started":
      return { ...base, verb: "Started inline image migration" };
    case "admin.heic_transcode.started":
      return { ...base, verb: "Started HEIC transcode" };
    case "admin.inline_image_migration.finished":
    case "admin.heic_transcode.finished": {
      const isHeic = event.eventType.startsWith("admin.heic");
      const updated = num(payload, "updatedDocs");
      const images = num(
        payload,
        isHeic ? "transcodedImages" : "migratedImageRefs",
      );
      const failures = num(payload, "failures") ?? 0;
      const parts = [
        updated === null ? null : `${plural(updated, "note")} updated`,
        images === null
          ? null
          : `${plural(images, "image")} ${isHeic ? "transcoded" : "moved"}`,
        failures > 0 ? plural(failures, "failure") : null,
        payload?.dryRun === true ? "dry run" : null,
      ].filter(Boolean);
      return {
        ...base,
        verb: isHeic
          ? "Finished HEIC transcode"
          : "Finished inline image migration",
        detail: parts.length > 0 ? parts.join(" · ") : null,
        href: "/admin/migrations",
        tone: failures > 0 ? "danger" : "default",
      };
    }
    default:
      return base;
  }
};

/** Collapses back-to-back events with the same type and note into one row. */
export const collapseRepeats = (events: ActionEventItem[]) => {
  const rows: { event: ActionEventItem; count: number }[] = [];
  for (const event of events) {
    const last = rows[rows.length - 1];
    if (
      last &&
      last.event.eventType === event.eventType &&
      (last.event.relatedDocId ?? null) === (event.relatedDocId ?? null) &&
      event.relatedDocId &&
      JSON.stringify(last.event.payload ?? null) ===
        JSON.stringify(event.payload ?? null)
    ) {
      last.count += 1;
      continue;
    }
    rows.push({ event, count: 1 });
  }
  return rows;
};

/** Calendar day key for grouping (YYYY-MM-DD) in the given time zone. */
export const dayKeyFor = (iso: string, timeZone: string) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
};

export const dayLabelFor = (
  dayKey: string,
  todayKey: string,
  yesterdayKey: string,
) => {
  if (dayKey === todayKey) return "Today";
  if (dayKey === yesterdayKey) return "Yesterday";
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
};

export const clockTimeFor = (iso: string, timeZone: string) => {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("dayPeriod")}`.trim();
};

export const groupByDay = (
  events: ActionEventItem[],
  timeZone: string,
  nowMs: number,
) => {
  const todayKey = dayKeyFor(new Date(nowMs).toISOString(), timeZone);
  const yesterdayKey = dayKeyFor(
    new Date(nowMs - 864e5).toISOString(),
    timeZone,
  );
  const groups: { key: string; label: string; events: ActionEventItem[] }[] =
    [];
  for (const event of events) {
    const key = dayKeyFor(event.createdAt, timeZone);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.events.push(event);
    } else {
      groups.push({
        key,
        label: dayLabelFor(key, todayKey, yesterdayKey),
        events: [event],
      });
    }
  }
  return groups;
};

/** Compact relative label ("just now", "12m ago", "5h ago") for today rows. */
export const relativeLabelFor = (iso: string, nowMs: number) => {
  const deltaMin = Math.floor((nowMs - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(deltaMin) || deltaMin < 1) return "just now";
  if (deltaMin < 60) return `${deltaMin}m ago`;
  return `${Math.floor(deltaMin / 60)}h ago`;
};
