import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
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
  removeShow,
  setDecision,
  updateEvent,
  updateShow,
  upsertPlace,
} from "./event-write-ops";
import type { ConnectorContext } from "./notes-shared";

// Events (notes with dated shows), places, and feeds over the notes
// connector. Event writes never touch note content; create_event makes its
// note through the connector's createNote.

export const EVENT_TOOL_SCOPES: Record<string, string> = {
  list_events: "notes:read",
  get_event: "notes:read",
  find_event_duplicates: "notes:read",
  list_places: "notes:read",
  list_feeds: "notes:read",
  create_event: "notes:write",
  update_event: "notes:write",
  add_shows: "notes:write",
  update_show: "notes:write",
  remove_show: "notes:write",
  set_decision: "notes:write",
  upsert_place: "notes:write",
};

export const EVENT_INSTRUCTIONS = [
  "Events are notes with dated shows, a place, and decisions (unreviewed, interested, tentative, booked, skipped, rejected) on the event and on each show separately; a show's effective decision is its own unless unreviewed.",
  "Before create_event, call find_event_duplicates with the title, official url, and show dates; if a candidate matches, get_event it and use add_shows or update_event instead. Never pass allowDuplicate just to get past a match.",
  "Reuse places: list_places or upsert_place (dedupes by name + city) before inventing one. Dates and times are America/Indiana/Indianapolis local unless you pass timeZone. When the start time is unknown, omit time or set timeConfirmed: false; never invent midnight.",
].join("\n");

type Guarded = (
  ctx: ConnectorContext,
  tool: string,
  fn: () => Promise<unknown>,
) => Promise<CallToolResult>;

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;
const write = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const noteIdArg = z.string().min(1).describe("Note id of the event");
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

export function registerEventTools(
  server: McpServer,
  ctx: ConnectorContext,
  guarded: Guarded,
): void {
  server.registerTool(
    "list_events",
    {
      title: "List upcoming shows",
      description:
        "Upcoming shows (one row per dated show) oldest first, with local date/time text, place, and effective decision. Defaults to today onward.",
      inputSchema: {
        from: localDate.optional().describe("First local date (default today)"),
        to: localDate.optional().describe("Last local date, inclusive"),
        collection: z.string().optional().describe("Collection id or name"),
        decisions: z
          .array(decisionSchema)
          .optional()
          .describe("Effective decisions to keep"),
        place: z.string().optional().describe("Place id or name"),
        search: z.string().optional().describe("Text in the event title"),
        includeCancelled: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
      annotations: readOnly,
    },
    (args) => guarded(ctx, "list_events", () => listEventShows(ctx, args)),
  );

  server.registerTool(
    "get_event",
    {
      title: "Get event",
      description:
        "One event by note id: url, summary, place, event decision, collection values, and every show with local date/time fields.",
      inputSchema: { noteId: noteIdArg },
      annotations: readOnly,
    },
    ({ noteId }) =>
      guarded(ctx, "get_event", () => getEventDetails(ctx, noteId)),
  );

  server.registerTool(
    "find_event_duplicates",
    {
      title: "Find duplicate events",
      description:
        "Existing events that look like this one: same canonical URL, same or near-same title, or a similar title with a show on the same date. Call before create_event.",
      inputSchema: {
        title: z.string().optional(),
        url: z.string().optional().describe("Official event or ticket URL"),
        dates: z
          .array(localDate)
          .max(100)
          .optional()
          .describe("Local show dates"),
      },
      annotations: readOnly,
    },
    (args) =>
      guarded(ctx, "find_event_duplicates", () =>
        findEventDuplicates(ctx, args),
      ),
  );

  server.registerTool(
    "create_event",
    {
      title: "Create event",
      description:
        "Create an event note with details, place, shows and/or a repeat, optionally as a row of a collection with property values by name. Refuses likely duplicates unless allowDuplicate is true.",
      inputSchema: {
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
        properties: z
          .record(z.unknown())
          .optional()
          .describe(
            'Collection values by property name, e.g. {"Category":"Comedy","Price":25}',
          ),
        url: z
          .string()
          .max(2000)
          .optional()
          .describe("Official event or ticket URL"),
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
      annotations: write,
    },
    (args) => guarded(ctx, "create_event", () => createEvent(ctx, args)),
  );

  server.registerTool(
    "update_event",
    {
      title: "Update event",
      description:
        "Patch event fields (url, summary, place, decision) by note id. Shows are unchanged; use the show tools for those.",
      inputSchema: {
        noteId: noteIdArg,
        ...eventPatchSchema.shape,
        place: placeArg,
      },
      annotations: { ...write, idempotentHint: true },
    },
    (args) => guarded(ctx, "update_event", () => updateEvent(ctx, args)),
  );

  server.registerTool(
    "add_shows",
    {
      title: "Add shows",
      description:
        "Add dated shows to an event, as a list and/or a repeat rule. Repeat dates already present are skipped.",
      inputSchema: { noteId: noteIdArg, shows: showsArg, repeat: repeatArg },
      annotations: write,
    },
    (args) => guarded(ctx, "add_shows", () => addShows(ctx, args)),
  );

  server.registerTool(
    "update_show",
    {
      title: "Update show",
      description:
        "Patch one show by occurrence id: date/time, timeConfirmed, label, place, ticket status, status, or decision.",
      inputSchema: {
        occurrenceId: z.string().min(1),
        ...occurrencePatchSchema.shape,
      },
      annotations: { ...write, idempotentHint: true },
    },
    (args) => guarded(ctx, "update_show", () => updateShow(args)),
  );

  server.registerTool(
    "remove_show",
    {
      title: "Remove show",
      description:
        "Delete one show by occurrence id. Prefer update_show with status cancelled when a show was called off.",
      inputSchema: { occurrenceId: z.string().min(1) },
      annotations: { ...write, destructiveHint: true },
    },
    (args) => guarded(ctx, "remove_show", () => removeShow(args)),
  );

  server.registerTool(
    "set_decision",
    {
      title: "Set decision",
      description:
        "Set the decision on the whole event (noteId) or on one show (occurrenceId), with an optional note. The two levels are independent.",
      inputSchema: {
        noteId: z.string().min(1).optional(),
        occurrenceId: z.string().min(1).optional(),
        decision: decisionSchema,
        note: z
          .string()
          .max(4000)
          .nullable()
          .optional()
          .describe("Why; null clears the note"),
      },
      annotations: { ...write, idempotentHint: true },
    },
    (args) => guarded(ctx, "set_decision", () => setDecision(ctx, args)),
  );

  server.registerTool(
    "list_places",
    {
      title: "List places",
      description:
        "Venues, restaurants, shops, and other places with address and coordinates.",
      inputSchema: {
        kind: placeKindSchema.optional(),
        search: z.string().optional().describe("Text in the name or city"),
        limit: z.number().int().min(1).max(500).optional(),
      },
      annotations: readOnly,
    },
    (args) => guarded(ctx, "list_places", () => listPlacesCompact(args)),
  );

  server.registerTool(
    "upsert_place",
    {
      title: "Find or create place",
      description:
        "Return the place with the same normalized name and city, or create it. Pass update: true to also patch a found place, geocode: true to look up missing coordinates (OpenStreetMap).",
      inputSchema: {
        ...placeInputSchema.shape,
        update: z.boolean().optional(),
        geocode: z.boolean().optional(),
      },
      annotations: { ...write, openWorldHint: true },
    },
    (args) => guarded(ctx, "upsert_place", () => upsertPlace(args)),
  );

  server.registerTool(
    "list_feeds",
    {
      title: "List calendar feeds",
      description:
        "Subscribable calendar feeds with their selection rule. Subscribe URLs are not shown here.",
      annotations: readOnly,
    },
    () => guarded(ctx, "list_feeds", () => listFeedSummaries()),
  );
}
