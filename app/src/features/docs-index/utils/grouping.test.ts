import { describe, expect, it } from "vitest";
import { groupByUpdatedAt, updatedBucket } from "./grouping";

const now = Date.parse("2026-10-21T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("updatedBucket", () => {
  it("uses rolling windows for the last 30 days", () => {
    expect(updatedBucket(ago(10 * 60 * 1000), now).label).toBe("Last hour");
    expect(updatedBucket(ago(5 * HOUR), now).label).toBe("Last 24 hours");
    expect(updatedBucket(ago(3 * DAY), now).label).toBe("Last 7 days");
    expect(updatedBucket(ago(20 * DAY), now).label).toBe("Last 30 days");
  });

  it("names calendar months for the past year, with the year when it differs", () => {
    expect(updatedBucket("2026-08-15T00:00:00Z", now).label).toBe("August");
    expect(updatedBucket("2025-12-01T00:00:00Z", now).label).toBe(
      "December 2025",
    );
  });

  it("falls back to whole years", () => {
    expect(updatedBucket("2025-10-01T00:00:00Z", now).label).toBe("2025");
    expect(updatedBucket("2023-03-01T00:00:00Z", now).label).toBe("2023");
  });
});

describe("groupByUpdatedAt", () => {
  it("keeps order and merges rows that share a bucket", () => {
    const items = [
      { id: "a", updatedAt: ago(HOUR / 2) },
      { id: "b", updatedAt: ago(2 * DAY) },
      { id: "c", updatedAt: ago(3 * DAY) },
    ];
    const groups = groupByUpdatedAt(items, now);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Last hour", ["a"]],
      ["Last 7 days", ["b", "c"]],
    ]);
  });
});
