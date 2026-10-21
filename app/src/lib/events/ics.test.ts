import { describe, expect, it } from "vitest";
import {
  buildIcs,
  escapeText,
  feedFileSlug,
  foldLine,
  formatUtc,
  type IcsShow,
} from "./ics";

const feed = { id: "feed1", name: "Date Nights", description: "Our plans" };

const show = (overrides: Partial<IcsShow> = {}): IcsShow => ({
  id: "occ1",
  title: "Jazz at the Jazz Kitchen",
  label: null,
  // 8:00 PM EST on Sat Nov 7, 2026
  startsAt: "2026-11-08T01:00:00.000Z",
  endsAt: "2026-11-08T03:30:00.000Z",
  allDay: false,
  timeConfirmed: true,
  timeZone: "America/Indiana/Indianapolis",
  effectivePlace: null,
  effectiveDecision: "booked",
  eventUrl: null,
  eventSummary: null,
  ticketStatus: null,
  status: "scheduled",
  sequence: 0,
  updatedAt: "2026-10-01T12:00:00.000Z",
  ...overrides,
});

const unfold = (ics: string) => ics.replace(/\r\n /g, "");
const lines = (ics: string) => unfold(ics).split("\r\n");

describe("escapeText", () => {
  it("escapes backslash, semicolon, comma, and newlines", () => {
    expect(escapeText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("folds at 75 octets with a leading space on continuations", () => {
    const folded = foldLine(`SUMMARY:${"x".repeat(200)}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(2);
    for (const part of parts)
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"x".repeat(200)}`);
  });

  it("never splits a multi-byte character", () => {
    const line = `SUMMARY:${"é🎷".repeat(40)}`;
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
      expect(part).not.toMatch(/�/);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("buildIcs", () => {
  it("writes the calendar header with CRLF endings", () => {
    const ics = buildIcs(feed, []);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
    expect(lines(ics)).toEqual([
      "BEGIN:VCALENDAR",
      "PRODID:-//Visual Notes//Events//EN",
      "VERSION:2.0",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Date Nights",
      "X-WR-CALDESC:Our plans",
      "REFRESH-INTERVAL;VALUE=DURATION:PT4H",
      "X-PUBLISHED-TTL:PT4H",
      "END:VCALENDAR",
      "",
    ]);
  });

  it("writes a timed show in UTC with the feed-scoped UID", () => {
    const out = lines(buildIcs(feed, [show({ sequence: 3 })]));
    expect(out).toContain("UID:occ1-feed1@visual-notes");
    expect(out).toContain("DTSTART:20261108T010000Z");
    expect(out).toContain("DTEND:20261108T033000Z");
    expect(out).toContain("DTSTAMP:20261001T120000Z");
    expect(out).toContain("LAST-MODIFIED:20261001T120000Z");
    expect(out).toContain("SEQUENCE:3");
    expect(out).toContain("STATUS:CONFIRMED");
    expect(out).toContain("SUMMARY:Jazz at the Jazz Kitchen");
  });

  it("defaults a missing end to two hours after the start", () => {
    const out = lines(buildIcs(feed, [show({ endsAt: null })]));
    expect(out).toContain("DTEND:20261108T030000Z");
  });

  it("publishes a TBD show as an all-day entry on its local date", () => {
    const out = lines(
      buildIcs(feed, [show({ timeConfirmed: false, label: "Night 2" })]),
    );
    // 01:00Z on Nov 8 is still Nov 7 in Indianapolis.
    expect(out).toContain("DTSTART;VALUE=DATE:20261107");
    expect(out).toContain("DTEND;VALUE=DATE:20261108");
    expect(out).toContain(
      "SUMMARY:Jazz at the Jazz Kitchen — Night 2 (time TBD)",
    );
  });

  it("spans multi-day all-day shows through their last day", () => {
    const out = lines(
      buildIcs(feed, [
        show({
          allDay: true,
          startsAt: "2026-11-07T05:00:00.000Z",
          endsAt: "2026-11-09T05:00:00.000Z",
        }),
      ]),
    );
    expect(out).toContain("DTSTART;VALUE=DATE:20261107");
    expect(out).toContain("DTEND;VALUE=DATE:20261110");
  });

  it("adds location, geo, url, description, and escapes text", () => {
    const out = lines(
      buildIcs(feed, [
        show({
          title: "Dinner; then a show, maybe",
          effectivePlace: {
            id: "p1",
            name: "The Vogue",
            kind: "venue",
            address: "6259 N College Ave, Indianapolis, IN 46220",
            latitude: 39.8708,
            longitude: -86.1426,
          },
          eventUrl: "https://example.com/tickets?id=1",
          eventSummary: "A fun night.\nBring cash.",
          ticketStatus: "Bought 2",
          status: "sold_out",
        }),
      ]),
    );
    expect(out).toContain("SUMMARY:Dinner\\; then a show\\, maybe");
    expect(out).toContain(
      "LOCATION:The Vogue\\, 6259 N College Ave\\, Indianapolis\\, IN 46220",
    );
    expect(out).toContain("GEO:39.8708;-86.1426");
    expect(out).toContain("URL:https://example.com/tickets?id=1");
    expect(out).toContain(
      "DESCRIPTION:A fun night.\\nBring cash.\\nTickets: Bought 2\\nStatus: Sold out",
    );
  });

  it("marks cancelled and tentative shows", () => {
    const cancelled = lines(buildIcs(feed, [show({ status: "cancelled" })]));
    expect(cancelled).toContain("STATUS:CANCELLED");
    const tentative = lines(
      buildIcs(feed, [show({ effectiveDecision: "tentative" })]),
    );
    expect(tentative).toContain("STATUS:TENTATIVE");
  });

  it("keeps every physical line within 75 octets", () => {
    const ics = buildIcs(feed, [
      show({ eventSummary: "Long ".repeat(80), title: "Ünïcode ".repeat(20) }),
    ]);
    for (const line of ics.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe("helpers", () => {
  it("formats UTC stamps and file slugs", () => {
    expect(formatUtc("2026-01-02T03:04:05.678Z")).toBe("20260102T030405Z");
    expect(feedFileSlug("Indy Programming Events!")).toBe(
      "indy-programming-events",
    );
    expect(feedFileSlug("   ")).toBe("calendar");
  });
});
