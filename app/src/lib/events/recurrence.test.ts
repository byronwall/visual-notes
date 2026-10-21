import { describe, expect, it } from "vitest";
import { describeRepeat, expandRepeat } from "./recurrence";
import { instantToWallClock, wallClockToInstant } from "./time";

const TZ = "America/Indiana/Indianapolis";

describe("wallClockToInstant", () => {
  it("uses EDT in summer and EST in winter", () => {
    expect(wallClockToInstant("2026-07-04", "19:30", TZ).toISOString()).toBe(
      "2026-07-04T23:30:00.000Z",
    );
    expect(wallClockToInstant("2026-12-04", "19:30", TZ).toISOString()).toBe(
      "2026-12-05T00:30:00.000Z",
    );
  });

  it("round-trips through instantToWallClock across the fall-back day", () => {
    const at = wallClockToInstant("2026-11-01", "20:00", TZ);
    expect(instantToWallClock(at, TZ)).toEqual({
      date: "2026-11-01",
      time: "20:00",
    });
  });
});

describe("expandRepeat", () => {
  it("keeps local start time through DST", () => {
    const shows = expandRepeat({
      startDate: "2026-10-27",
      startTime: "18:00",
      durationMinutes: 90,
      timeZone: TZ,
      rule: { freq: "weekly" },
      count: 3,
    });
    expect(shows.map((s) => s.date)).toEqual([
      "2026-10-27",
      "2026-11-03",
      "2026-11-10",
    ]);
    expect(shows.map((s) => instantToWallClock(s.startsAt, TZ).time)).toEqual([
      "18:00",
      "18:00",
      "18:00",
    ]);
    expect(shows[0]!.endsAt).toBe("2026-10-27T23:30:00.000Z");
  });

  it("expands the 2nd Tuesday of each month", () => {
    const shows = expandRepeat({
      startDate: "2026-10-13",
      startTime: "18:30",
      timeZone: TZ,
      rule: { freq: "monthly", by: "nth-weekday" },
      count: 4,
    });
    expect(shows.map((s) => s.date)).toEqual([
      "2026-10-13",
      "2026-11-10",
      "2026-12-08",
      "2027-01-12",
    ]);
    expect(
      describeRepeat({ freq: "monthly", by: "nth-weekday" }, "2026-10-13"),
    ).toBe("Monthly on the 2nd Tue");
  });

  it("treats a 5th weekday as the last one", () => {
    const shows = expandRepeat({
      startDate: "2026-10-30",
      timeZone: TZ,
      rule: { freq: "monthly", by: "nth-weekday" },
      count: 2,
    });
    expect(shows.map((s) => s.date)).toEqual(["2026-10-30", "2026-11-27"]);
  });

  it("skips months without the day and stops at until", () => {
    const shows = expandRepeat({
      startDate: "2027-01-31",
      timeZone: TZ,
      rule: { freq: "monthly" },
      until: "2027-05-31",
    });
    expect(shows.map((s) => s.date)).toEqual([
      "2027-01-31",
      "2027-03-31",
      "2027-05-31",
    ]);
  });

  it("supports several weekdays per week", () => {
    const shows = expandRepeat({
      startDate: "2026-10-21",
      timeZone: TZ,
      rule: { freq: "weekly", weekdays: [1, 3] },
      count: 3,
    });
    expect(shows.map((s) => s.date)).toEqual([
      "2026-10-21",
      "2026-10-26",
      "2026-10-28",
    ]);
  });

  it("requires a count or until", () => {
    expect(() =>
      expandRepeat({
        startDate: "2026-10-21",
        timeZone: TZ,
        rule: { freq: "daily" },
      }),
    ).toThrow();
  });
});

describe("formatShowWhen", () => {
  it("formats in the show's zone, with TBD and all-day cases", async () => {
    const { formatShowWhen } = await import("./format");
    const base = { timeZone: TZ, allDay: false, timeConfirmed: true };
    expect(
      formatShowWhen({
        ...base,
        startsAt: "2026-11-08T01:00:00.000Z",
        endsAt: "2026-11-08T04:30:00.000Z",
      }),
    ).toBe("Sat, Nov 7 · 8:00 PM – 11:30 PM");
    expect(
      formatShowWhen({
        ...base,
        timeConfirmed: false,
        startsAt: "2026-11-08T05:00:00.000Z",
        endsAt: null,
      }),
    ).toBe("Sun, Nov 8 · Time TBD");
    expect(
      formatShowWhen(
        {
          ...base,
          allDay: true,
          startsAt: "2026-11-08T05:00:00.000Z",
          endsAt: null,
        },
        2025,
      ),
    ).toBe("Sun, Nov 8, 2026 · All day");
  });
});
