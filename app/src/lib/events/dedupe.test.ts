import { describe, expect, it } from "vitest";
import {
  canonicalizeUrl,
  findDuplicateMatches,
  matchEvent,
  normalizeTitle,
  titleSimilarity,
} from "./dedupe";

describe("canonicalizeUrl", () => {
  it("treats protocol, www, case, trailing slash, and hash as the same link", () => {
    const a = canonicalizeUrl(
      "https://www.Example.com/Events/Jazz-Night/#tickets",
    );
    expect(a).toBe("example.com/Events/Jazz-Night");
    expect(canonicalizeUrl("http://example.com/Events/Jazz-Night")).toBe(a);
    expect(canonicalizeUrl("example.com/Events/Jazz-Night/")).toBe(a);
  });

  it("drops tracking params and sorts the rest", () => {
    expect(
      canonicalizeUrl(
        "https://tickets.test/show?utm_source=fb&b=2&fbclid=x&a=1&UTM_Medium=m",
      ),
    ).toBe("tickets.test/show?a=1&b=2");
  });

  it("keeps the root path empty and returns null for blanks", () => {
    expect(canonicalizeUrl("https://www.venue.test/")).toBe("venue.test");
    expect(canonicalizeUrl("  ")).toBeNull();
    expect(canonicalizeUrl(null)).toBeNull();
  });
});

describe("title matching", () => {
  it("normalizes accents, punctuation, ampersands, and a leading the", () => {
    expect(normalizeTitle("The Café Jazz & Blues!")).toBe(
      "cafe jazz and blues",
    );
  });

  it("scores containment and token overlap", () => {
    expect(titleSimilarity("Jazz Night", "jazz night")).toBe(1);
    expect(titleSimilarity("Yo-Yo Ma at the Palladium", "Yo-Yo Ma")).toBe(0.9);
    expect(titleSimilarity("Indy Jazz Fest", "Indy Film Fest")).toBeCloseTo(
      2 / 3,
    );
    expect(titleSimilarity("Comedy Night", "Ballet Gala")).toBe(0);
  });
});

describe("matchEvent", () => {
  const candidate = {
    title: "Jazz at the Kitchen",
    url: "https://thejazzkitchen.test/events/42?utm_campaign=x",
    dates: ["2026-11-07", "2026-11-14"],
  };

  it("is high confidence on the same canonical URL", () => {
    const m = matchEvent(
      { url: "http://www.thejazzkitchen.test/events/42/" },
      candidate,
    );
    expect(m?.confidence).toBe("high");
    expect(m?.reasons).toContain("same canonical URL");
  });

  it("is medium for the same title without a shared date, high with one", () => {
    expect(
      matchEvent({ title: "Jazz at the Kitchen" }, candidate)?.confidence,
    ).toBe("medium");
    const dated = matchEvent(
      { title: "jazz at the kitchen", dates: ["2026-11-14"] },
      candidate,
    );
    expect(dated?.confidence).toBe("high");
    expect(dated?.matchingDates).toEqual(["2026-11-14"]);
  });

  it("needs a shared date for a merely similar title", () => {
    const q = { title: "Jazz Kitchen Late Set" };
    expect(
      matchEvent(q, { ...candidate, title: "Jazz Kitchen Early Set" }),
    ).toBeNull();
    expect(
      matchEvent(
        { ...q, dates: ["2026-11-07"] },
        { ...candidate, title: "Jazz Kitchen Early Set" },
      )?.confidence,
    ).toBe("possible");
  });

  it("ignores a shared date alone", () => {
    expect(
      matchEvent({ title: "Ballet Gala", dates: ["2026-11-07"] }, candidate),
    ).toBeNull();
  });

  it("ranks the most confident match first", () => {
    const results = findDuplicateMatches(
      { title: "Jazz at the Kitchen", url: candidate.url },
      [{ title: "Jazz at the Kitchen", url: null, dates: [] }, candidate],
    );
    expect(results.map((r) => r.match.confidence)).toEqual(["high", "medium"]);
  });
});
