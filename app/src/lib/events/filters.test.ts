import { describe, expect, it } from "vitest";
import {
  filtersToParams,
  listStartDate,
  matchesShowFilters,
  parseEventsFilters,
  parseMonth,
  parsePlaceKind,
} from "./filters";
import { groupByDay, groupShowsByPlace, shortStart } from "./grouping";
import type { OccurrenceListItem } from "./types";

const show = (over: Partial<OccurrenceListItem>): OccurrenceListItem => ({
  id: "o1",
  eventId: "e1",
  label: null,
  startsAt: "2026-10-21T00:00:00.000Z",
  endsAt: null,
  allDay: false,
  timeConfirmed: true,
  timeZone: "America/Indiana/Indianapolis",
  placeId: null,
  place: null,
  ticketStatus: null,
  status: "scheduled",
  decision: "unreviewed",
  decisionNote: null,
  sourceBlockId: null,
  sequence: 0,
  updatedAt: "2026-10-01T00:00:00.000Z",
  docId: "d1",
  title: "Jazz night",
  collectionId: null,
  eventDecision: "interested",
  eventUrl: null,
  eventSummary: null,
  effectivePlace: null,
  effectiveDecision: "interested",
  ...over,
});

describe("events filters", () => {
  it("parses URL params and drops unknown decisions", () => {
    expect(
      parseEventsFilters({
        collection: "c1",
        decision: "booked,nope,interested",
        past: "1",
        q: " jazz ",
      }),
    ).toEqual({
      collection: "c1",
      decisions: ["interested", "booked"],
      past: true,
      q: "jazz",
    });
    expect(parseEventsFilters({})).toEqual({
      collection: "all",
      decisions: [],
      past: false,
      q: "",
    });
  });

  it("clears default values from the URL", () => {
    expect(
      filtersToParams({
        collection: "all",
        decisions: [],
        past: false,
        q: " ",
      }),
    ).toEqual({
      collection: undefined,
      decision: undefined,
      past: undefined,
      q: undefined,
    });
    expect(filtersToParams({ decisions: ["booked", "tentative"] })).toEqual({
      decision: "booked,tentative",
    });
  });

  it("parses months, kinds, and the list window", () => {
    expect(parseMonth("2026-02", "2026-10-20")).toBe("2026-02");
    expect(parseMonth("2026-13", "2026-10-20")).toBe("2026-10");
    expect(parsePlaceKind("shop")).toBe("shop");
    expect(parsePlaceKind("castle")).toBeUndefined();
    expect(listStartDate("2026-10-20", true)).toBe("2026-09-20");
  });

  it("matches loose notes and title search", () => {
    const loose = show({});
    const inCollection = show({ collectionId: "c1" });
    expect(matchesShowFilters(loose, { collection: "loose", q: "" })).toBe(
      true,
    );
    expect(
      matchesShowFilters(inCollection, { collection: "loose", q: "" }),
    ).toBe(false);
    expect(matchesShowFilters(loose, { collection: "all", q: "JAZZ" })).toBe(
      true,
    );
    expect(matchesShowFilters(loose, { collection: "all", q: "opera" })).toBe(
      false,
    );
  });
});

describe("events grouping", () => {
  it("groups shows by local day", () => {
    // 00:00Z on the 21st is still the evening of the 20th in Indianapolis.
    const groups = groupByDay([
      show({ id: "a" }),
      show({ id: "b", startsAt: "2026-10-21T15:00:00.000Z" }),
    ]);
    expect(groups.map((g) => [g.date, g.shows.length])).toEqual([
      ["2026-10-20", 1],
      ["2026-10-21", 1],
    ]);
  });

  it("formats compact start times", () => {
    expect(shortStart(show({}))).toBe("8pm");
    expect(shortStart(show({ startsAt: "2026-10-21T23:30:00.000Z" }))).toBe(
      "7:30pm",
    );
    expect(shortStart(show({ timeConfirmed: false }))).toBe("TBD");
    expect(shortStart(show({ allDay: true }))).toBe("");
  });

  it("groups shows by mapped place and counts the rest", () => {
    const place = {
      id: "p1",
      name: "Jazz Kitchen",
      kind: "venue" as const,
      address: "",
      latitude: 39.8,
      longitude: -86.1,
    };
    const { points, unmapped } = groupShowsByPlace([
      show({ id: "a", effectivePlace: place }),
      show({ id: "b", effectivePlace: place }),
      show({ id: "c" }),
      show({ id: "d", effectivePlace: { ...place, id: "p2", latitude: null } }),
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]!.shows.map((s) => s.id)).toEqual(["a", "b"]);
    expect(unmapped).toBe(2);
  });
});
