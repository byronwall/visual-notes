import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteEvent, Occurrence, Place } from "~/lib/events/types";

// Contract test: the real notes MCP server with event tools registered,
// talking to the SDK client in memory. Prisma, stores, and geocoding are fakes.

const db = vi.hoisted(() => ({
  doc: { findUnique: vi.fn() },
  event: { findMany: vi.fn(), findUnique: vi.fn() },
  place: { findMany: vi.fn() },
  collection: { findFirst: vi.fn(), findMany: vi.fn() },
  calendarFeed: { findMany: vi.fn() },
}));
const events = vi.hoisted(() => ({
  getNoteEvent: vi.fn(),
  upsertNoteEvent: vi.fn(),
  addOccurrences: vi.fn(),
  addRepeatingOccurrences: vi.fn(),
  updateOccurrence: vi.fn(),
  deleteOccurrence: vi.fn(),
  listOccurrences: vi.fn(),
  listEvents: vi.fn(),
}));
const places = vi.hoisted(() => ({
  findOrCreatePlace: vi.fn(),
  getPlace: vi.fn(),
  updatePlace: vi.fn(),
  findPlacesByName: vi.fn(),
  listPlaces: vi.fn(),
}));
const collections = vi.hoisted(() => ({
  attachNotes: vi.fn(),
  applyRowPatch: vi.fn(),
  loadLiveProperties: vi.fn(),
}));
const notesWrite = vi.hoisted(() => ({ createNote: vi.fn() }));
const geocode = vi.hoisted(() => ({ geocodePlace: vi.fn() }));

vi.mock("~/server/db", () => ({ prisma: db }));
vi.mock("~/server/calendar/event-store", async (orig) => ({
  ...(await orig<object>()),
  ...events,
}));
vi.mock("~/server/calendar/place-store", async (orig) => ({
  ...(await orig<object>()),
  ...places,
}));
vi.mock("~/server/calendar/geocode", () => geocode);
vi.mock("~/services/collections/collections.server", () => collections);
vi.mock("~/services/collections/collection-text", () => ({
  collectionTextForNotes: vi.fn(async () => ({
    n1: { collection: "Date Nights", properties: { Category: "Music" } },
  })),
}));
vi.mock("./notes-read", () => ({
  getNotes: vi.fn(),
  listNotePaths: vi.fn(),
  listRecentNotes: vi.fn(),
  searchNotes: vi.fn(),
  MAX_NOTES_PER_GET: 10,
}));
vi.mock("./notes-write", () => ({
  ...notesWrite,
  appendToNote: vi.fn(),
  editNote: vi.fn(),
  updateNote: vi.fn(),
}));

const { createNotesMcpServer } = await import("./tools");

const connect = async (scopes = ["notes:read", "notes:write"]) => {
  const server = createNotesMcpServer({
    origin: "https://notes.test",
    actorId: "chatgpt:test",
    scopes,
    scopeChallenge: 'Bearer error="insufficient_scope"',
  });
  const client = new Client({ name: "contract-test", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
};

type CallResult = Awaited<ReturnType<Client["callTool"]>>;
const textOf = (result: CallResult) =>
  (result.content as { type: string; text: string }[])[0]!.text;
const jsonOf = (result: CallResult) => JSON.parse(textOf(result));

const place: Place = {
  id: "p1",
  name: "The Jazz Kitchen",
  kind: "venue",
  address: "5377 N College Ave, Indianapolis, IN",
  latitude: null,
  longitude: null,
  street: "5377 N College Ave",
  city: "Indianapolis",
  state: "IN",
  postalCode: null,
  url: null,
  notes: null,
  docId: null,
  createdAt: "",
  updatedAt: "",
};

const show = (
  id: string,
  startsAt: string,
  decision: Occurrence["decision"] = "unreviewed",
): Occurrence => ({
  id,
  eventId: "e1",
  label: null,
  startsAt,
  endsAt: null,
  allDay: false,
  timeConfirmed: true,
  timeZone: "America/Indiana/Indianapolis",
  placeId: null,
  place: null,
  ticketStatus: null,
  status: "scheduled",
  decision,
  decisionNote: null,
  sourceBlockId: null,
  sequence: 0,
  updatedAt: "",
});

const noteEvent = (overrides: Partial<NoteEvent> = {}): NoteEvent => ({
  id: "e1",
  docId: "n1",
  url: "https://thejazzkitchen.test/events/42",
  summary: "Late set",
  placeId: "p1",
  place: {
    id: "p1",
    name: place.name,
    kind: "venue",
    address: place.address,
    latitude: 39.8,
    longitude: -86.1,
  },
  decision: "unreviewed",
  decisionNote: null,
  // 2026-11-07 20:00 and 2026-11-14 20:00 in Indianapolis (EST).
  occurrences: [
    show("o1", "2026-11-08T01:00:00.000Z"),
    show("o2", "2026-11-15T01:00:00.000Z", "booked"),
  ],
  updatedAt: "",
  ...overrides,
});

beforeEach(() => {
  db.event.findMany.mockResolvedValue([]);
  db.doc.findUnique.mockResolvedValue({
    id: "n1",
    title: "Jazz Late Set",
    collectionId: null,
  });
  events.getNoteEvent.mockResolvedValue(noteEvent());
  events.upsertNoteEvent.mockResolvedValue(noteEvent());
  notesWrite.createNote.mockResolvedValue({
    id: "n1",
    title: "Jazz Late Set",
    path: null,
    url: "",
    version: 1,
    pathIsNew: false,
    deduplicated: false,
  });
});

afterEach(() => vi.clearAllMocks());

describe("event MCP tools", () => {
  it("are listed next to the notes tools", async () => {
    const client = await connect();
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "search",
        "list_events",
        "get_event",
        "find_event_duplicates",
        "create_event",
        "update_event",
        "add_shows",
        "update_show",
        "remove_show",
        "set_decision",
        "list_places",
        "upsert_place",
        "list_feeds",
      ]),
    );
  });

  it("refuses a likely duplicate and creates nothing", async () => {
    db.event.findMany.mockResolvedValue([
      {
        id: "e9",
        docId: "n9",
        url: "https://www.thejazzkitchen.test/events/42/?utm_source=x",
        doc: { title: "Jazz Kitchen: Late Set" },
        occurrences: [
          {
            startsAt: new Date("2026-11-08T01:00:00Z"),
            timeZone: "America/Indiana/Indianapolis",
          },
        ],
      },
    ]);
    const client = await connect();
    const result = await client.callTool({
      name: "create_event",
      arguments: {
        title: "Late Set",
        url: "http://thejazzkitchen.test/events/42",
        shows: [{ date: "2026-11-07", time: "20:00" }],
      },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("duplicate: Nothing was created");
    expect(textOf(result)).toContain("noteId n9, high");
    expect(textOf(result)).toContain("same canonical URL");
    expect(notesWrite.createNote).not.toHaveBeenCalled();
    expect(events.upsertNoteEvent).not.toHaveBeenCalled();

    const check = await client.callTool({
      name: "find_event_duplicates",
      arguments: { title: "Jazz Kitchen - Late Set", dates: ["2026-11-07"] },
    });
    expect(jsonOf(check)).toMatchObject({
      exists: true,
      candidates: [{ noteId: "n9", confidence: "high" }],
    });

    const forced = await client.callTool({
      name: "create_event",
      arguments: {
        title: "Late Set",
        url: "http://thejazzkitchen.test/events/42",
        allowDuplicate: true,
      },
    });
    expect(forced.isError).toBeFalsy();
    expect(jsonOf(forced).allowedDuplicates).toHaveLength(1);
  });

  it("creates a collection row with a new geocoded place and a repeat", async () => {
    db.collection.findFirst.mockResolvedValue(null);
    db.collection.findMany.mockResolvedValue([
      { id: "c1", name: "Date Nights" },
    ]);
    db.doc.findUnique.mockResolvedValue({
      id: "n1",
      title: "Jazz Late Set",
      collectionId: "c1",
    });
    collections.loadLiveProperties.mockResolvedValue([
      {
        id: "prop_cat",
        name: "Category",
        kind: "select",
        position: 0,
        config: {
          options: [{ id: "opt_music", name: "Music", color: "blue" }],
        },
      },
    ]);
    places.findOrCreatePlace.mockResolvedValue({ place, created: true });
    geocode.geocodePlace.mockResolvedValue({
      ok: true,
      latitude: 39.85,
      longitude: -86.14,
      displayName: "",
      query: place.address,
    });
    places.updatePlace.mockResolvedValue({
      ...place,
      latitude: 39.85,
      longitude: -86.14,
    });
    const repeat = {
      show: { date: "2026-11-07", time: "20:00" },
      rule: { freq: "weekly" },
      count: 4,
    };
    const client = await connect();
    const result = await client.callTool({
      name: "create_event",
      arguments: {
        title: "Jazz Late Set",
        url: "https://thejazzkitchen.test/events/42",
        summary: "Late set",
        collection: "date nights",
        properties: { category: "music" },
        place: {
          name: "The Jazz Kitchen",
          street: "5377 N College Ave",
          city: "Indianapolis",
          state: "IN",
          geocode: true,
        },
        repeat,
      },
    });
    expect(result.isError).toBeFalsy();
    expect(notesWrite.createNote).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "chatgpt:test" }),
      expect.objectContaining({
        title: "Jazz Late Set",
        markdown: "Late set\n\n<https://thejazzkitchen.test/events/42>",
      }),
    );
    expect(collections.attachNotes).toHaveBeenCalledWith("c1", ["n1"]);
    expect(collections.applyRowPatch).toHaveBeenCalledWith("c1", "n1", {
      prop_cat: "opt_music",
    });
    expect(places.updatePlace).toHaveBeenCalledWith("p1", {
      latitude: 39.85,
      longitude: -86.14,
    });
    expect(events.upsertNoteEvent).toHaveBeenCalledWith(
      "n1",
      expect.objectContaining({
        placeId: "p1",
        url: "https://thejazzkitchen.test/events/42",
      }),
    );
    expect(events.addRepeatingOccurrences).toHaveBeenCalledWith("n1", repeat);
    const body = jsonOf(result);
    expect(body.placeResult).toMatchObject({
      id: "p1",
      created: true,
      geocode: { status: "found" },
    });
    expect(body.collection).toMatchObject({ id: "c1", name: "Date Nights" });
    expect(body.shows[0]).toMatchObject({
      date: "2026-11-07",
      time: "20:00",
      when: "Sat, Nov 7 · 8:00 PM",
    });
  });

  it("refuses an unknown select option before creating the note", async () => {
    db.collection.findFirst.mockResolvedValue({
      id: "c1",
      name: "Date Nights",
    });
    collections.loadLiveProperties.mockResolvedValue([
      {
        id: "prop_cat",
        name: "Category",
        kind: "select",
        position: 0,
        config: {
          options: [{ id: "opt_music", name: "Music", color: "blue" }],
        },
      },
    ]);
    const client = await connect();
    const result = await client.callTool({
      name: "create_event",
      arguments: {
        title: "Ballet Gala",
        collection: "c1",
        properties: { Category: "Dance" },
      },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(
      'Category: unknown option "Dance". Options: Music',
    );
    expect(notesWrite.createNote).not.toHaveBeenCalled();
  });

  it("keeps event and show decisions independent", async () => {
    events.getNoteEvent.mockResolvedValue(
      noteEvent({ decision: "interested" }),
    );
    const client = await connect();
    const eventLevel = await client.callTool({
      name: "set_decision",
      arguments: { noteId: "n1", decision: "interested", note: "Looks fun" },
    });
    expect(events.upsertNoteEvent).toHaveBeenCalledWith("n1", {
      decision: "interested",
      decisionNote: "Looks fun",
    });
    expect(events.updateOccurrence).not.toHaveBeenCalled();
    expect(jsonOf(eventLevel).shows).toEqual([
      expect.objectContaining({
        occurrenceId: "o1",
        showDecision: "unreviewed",
        effectiveDecision: "interested",
      }),
      expect.objectContaining({
        occurrenceId: "o2",
        showDecision: "booked",
        effectiveDecision: "booked",
      }),
    ]);

    vi.clearAllMocks();
    events.updateOccurrence.mockResolvedValue(
      show("o1", "2026-11-08T01:00:00.000Z", "skipped"),
    );
    db.event.findUnique.mockResolvedValue({
      decision: "interested",
      docId: "n1",
    });
    const showLevel = await client.callTool({
      name: "set_decision",
      arguments: { occurrenceId: "o1", decision: "skipped" },
    });
    expect(events.updateOccurrence).toHaveBeenCalledWith("o1", {
      decision: "skipped",
    });
    expect(events.upsertNoteEvent).not.toHaveBeenCalled();
    expect(jsonOf(showLevel)).toMatchObject({
      target: "show",
      showDecision: "skipped",
      effectiveDecision: "skipped",
    });

    const both = await client.callTool({
      name: "set_decision",
      arguments: { noteId: "n1", occurrenceId: "o1", decision: "booked" },
    });
    expect(both.isError).toBe(true);
  });

  it("reports a missing show as not found", async () => {
    events.updateOccurrence.mockRejectedValue(new Error("Show not found"));
    const client = await connect();
    const result = await client.callTool({
      name: "update_show",
      arguments: { occurrenceId: "nope", status: "cancelled" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("not_found: Show not found");
  });

  it("needs notes:write for writes but not for reads", async () => {
    events.listOccurrences.mockResolvedValue([]);
    const client = await connect(["notes:read"]);
    const write = await client.callTool({
      name: "create_event",
      arguments: { title: "x" },
    });
    expect(write.isError).toBe(true);
    expect(write._meta).toMatchObject({
      "mcp/www_authenticate": ['Bearer error="insufficient_scope"'],
    });
    expect(db.event.findMany).not.toHaveBeenCalled();
    const decision = await client.callTool({
      name: "set_decision",
      arguments: { noteId: "n1", decision: "booked" },
    });
    expect(decision.isError).toBe(true);
    const read = await client.callTool({ name: "list_events", arguments: {} });
    expect(read.isError).toBeFalsy();
  });

  it("lists feeds without their tokens", async () => {
    db.calendarFeed.findMany.mockResolvedValue([
      {
        id: "f1",
        name: "Date Nights",
        description: null,
        decisions: ["interested", "booked"],
        pastDays: 90,
        collection: { id: "c1", name: "Date Nights" },
        view: { id: "v1", name: "Upcoming" },
        entries: [{ mode: "include" }, { mode: "exclude" }],
      },
    ]);
    const client = await connect(["notes:read"]);
    const result = await client.callTool({ name: "list_feeds", arguments: {} });
    expect(textOf(result)).not.toContain("token");
    expect(
      db.calendarFeed.findMany.mock.calls[0]![0].select.token,
    ).toBeUndefined();
    expect(jsonOf(result).results[0].rule).toBe(
      'rows of "Date Nights" matching view "Upcoming"; decisions: interested, booked; 90 past days; +1 included; 1 excluded',
    );
  });
});
