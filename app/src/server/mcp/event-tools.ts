import { z } from "zod";
import {
  decisionSchema,
  eventPatchSchema,
  occurrenceInputSchema,
  occurrencePatchSchema,
  placeInputSchema,
  placeKindSchema,
  repeatInputSchema,
} from "~/lib/events/schemas";
import { DEFAULT_TIME_ZONE } from "~/lib/events/types";
import {
  findEventDuplicates,
  getEventDetails,
  listEventShows,
  listFeedSummaries,
  listPlacesCompact,
} from "./event-read-ops";
import {
  addShows,
  createEvent,
  updateEvent,
  updateShow,
  upsertPlace,
} from "./event-write-ops";
import { dayArg, limitArg, noteIdArg } from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// Events (notes with dated shows), places, and calendar feeds. An event is
// identified by its note's id; each show has its own showId. Event writes
// never touch note content; events_create makes its note through the
// connector's createNote. Deleting events and shows stays with the user:
// a show that was called off gets status cancelled.

export const EVENT_INSTRUCTIONS = [
  "Events are notes with dated shows, a place, and decisions (unreviewed, interested, tentative, booked, skipped, rejected) on the event and on each show separately; a show's effective decision is its own unless unreviewed. Set them with events_update (event) or events_update_show (one show).",
  "Before events_create, call events_find_duplicates with the title, official url, and show dates; if a candidate matches, events_get it and use events_add_shows or events_update instead. Never pass allowDuplicate just to get past a match.",
  `Reuse places: places_list or places_upsert (dedupes by name + city) before inventing one. Event dates and times are ${DEFAULT_TIME_ZONE} local unless you pass timeZone. When the start time is unknown, omit time or set timeConfirmed: false; never invent midnight.`,
].join("\n");

const eventIdArg = noteIdArg.describe("The event's note id");
const showsArg = z
  .array(occurrenceInputSchema)
  .max(100)
  .optional()
  .describe(
    "Shows in local terms: date YYYY-MM-DD, time HH:mm (omit for all-day), optional endDate/endTime, timeZone, timeConfirmed, label, placeId, ticketStatus, status, decision",
  );
const repeatArg = repeatInputSchema
  .optional()
  .describe(
    "A repeat rule expanded into explicit shows: {show, rule:{freq:daily|weekly|monthly,...}, count?, until?}",
  );
const placeArg = placeInputSchema
  .extend({
    geocode: z
      .boolean()
      .optional()
      .describe("Look up coordinates for a newly created place"),
  })
  .optional()
  .describe(
    "Event place by fields; an existing place with the same name + city is reused",
  );
const webUrlArg = z
  .string()
  .max(2000)
  .optional()
  .describe("Official event or ticket web address");

export function registerEventTools(tools: ToolRegistrar): void {
  const { ctx } = tools;

  tools.read(
    "events_query",
    {
      title: "Query event shows",
      description:
        "Upcoming shows (one row per dated show) oldest first, with local date/time text, place, and effective decision. Defaults to today onward.",
      input: {
        from: dayArg.optional().describe("First local day (default today)"),
        to: dayArg.optional().describe("Last local day, inclusive"),
        collection: z.string().optional().describe("Collection id or name"),
        decisions: z
          .array(decisionSchema)
          .optional()
          .describe("Effective decisions to keep"),
        place: z.string().optional().describe("Place id or name"),
        search: z.string().optional().describe("Text in the event title"),
        includeCancelled: z.boolean().optional(),
        limit: limitArg(200, 50),
      },
    },
    (args) => listEventShows(ctx, args),
  );

  tools.read(
    "events_get",
    {
      title: "Get event",
      description:
        "One event by note id: web url, summary, place, event decision, collection values, and every show with local date/time fields.",
      input: { noteId: eventIdArg },
    },
    ({ noteId }) => getEventDetails(ctx, noteId),
  );

  tools.read(
    "events_find_duplicates",
    {
      title: "Find duplicate events",
      description:
        "Existing events that look like this one: same canonical URL, same or near-same title, or a similar title with a show on the same date. Call before events_create.",
      input: {
        title: z.string().optional(),
        url: webUrlArg,
        dates: z.array(dayArg).max(100).optional().describe("Local show days"),
      },
    },
    (args) => findEventDuplicates(ctx, args),
  );

  tools.write(
    "events_create",
    {
      title: "Create event",
      description:
        "Create an event note with details, place, shows and/or a repeat, optionally as a row of a collection with values by property name (missing option names are created). Refuses likely duplicates unless allowDuplicate is true.",
      input: {
        title: z.string().min(1).max(200),
        markdown: z
          .string()
          .optional()
          .describe("Note body; defaults to the summary and url"),
        path: z.string().max(512).optional().describe("Dot path for the note"),
        idempotencyKey: z
          .string()
          .max(200)
          .optional()
          .describe("Same key returns the first event instead of a duplicate"),
        collection: z
          .string()
          .optional()
          .describe("Collection id or name to add the note to as a row"),
        values: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Collection values by property name, as in collections_set_values, e.g. {"Category":"Comedy","Price":25}',
          ),
        url: webUrlArg,
        summary: z
          .string()
          .max(4000)
          .optional()
          .describe("Short plain-text blurb for calendar entries"),
        placeId: z.string().optional().describe("Existing place id"),
        place: placeArg,
        decision: decisionSchema.optional(),
        decisionNote: z.string().max(4000).optional(),
        shows: showsArg,
        repeat: repeatArg,
        allowDuplicate: z
          .boolean()
          .optional()
          .describe(
            "Only after reviewing candidates and confirming it is a different event",
          ),
      },
    },
    (args) => createEvent(ctx, args),
  );

  tools.write(
    "events_update",
    {
      title: "Update event",
      description:
        "Patch event fields (web url, summary, place, decision, decisionNote) by note id; a note that is not an event yet becomes one. Shows are unchanged; use events_add_shows / events_update_show for those.",
      input: {
        noteId: eventIdArg,
        ...eventPatchSchema.shape,
        place: placeArg,
      },
      idempotent: true,
    },
    (args) => updateEvent(ctx, args),
  );

  tools.write(
    "events_add_shows",
    {
      title: "Add event shows",
      description:
        "Add dated shows to an event, as a list and/or a repeat rule. Repeat dates already present are skipped.",
      input: { noteId: eventIdArg, shows: showsArg, repeat: repeatArg },
    },
    (args) => addShows(ctx, args),
  );

  tools.write(
    "events_update_show",
    {
      title: "Update event show",
      description:
        "Patch one show by showId: date/time, timeConfirmed, label, place, ticket status, status, decision, or decisionNote. A show that was called off gets status cancelled; removing shows stays with the user.",
      input: {
        showId: z.string().min(1).describe("From events_get or events_query"),
        ...occurrencePatchSchema.shape,
      },
      idempotent: true,
    },
    (args) => updateShow(ctx, args),
  );

  tools.read(
    "events_list_feeds",
    {
      title: "List calendar feeds",
      description:
        "Subscribable calendar feeds of events, with their selection rule. Subscribe URLs are not shown here.",
    },
    async () => ({ feeds: await listFeedSummaries() }),
  );

  tools.read(
    "places_list",
    {
      title: "List places",
      description:
        "Venues, restaurants, shops, and other places with address and coordinates.",
      input: {
        kind: placeKindSchema.optional(),
        search: z.string().optional().describe("Text in the name or city"),
        limit: limitArg(500, 100),
      },
    },
    (args) => listPlacesCompact(args),
  );

  tools.write(
    "places_upsert",
    {
      title: "Find or create place",
      description:
        "Return the place with the same normalized name and city, or create it. Pass update: true to also patch a found place, geocode: true to look up missing coordinates (OpenStreetMap).",
      input: {
        ...placeInputSchema.shape,
        update: z.boolean().optional(),
        geocode: z.boolean().optional(),
      },
      openWorld: true,
    },
    (args) => upsertPlace(ctx, args),
  );
}
