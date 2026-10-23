import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./time";

const now = Date.parse("2026-10-21T12:00:00Z");
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();

describe("formatRelativeTime", () => {
  it("never reports zero months between four weeks and a month", () => {
    expect(formatRelativeTime(daysAgo(27), now)).toBe("3w ago");
    expect(formatRelativeTime(daysAgo(28), now)).toBe("1mo ago");
    expect(formatRelativeTime(daysAgo(29), now)).toBe("1mo ago");
    expect(formatRelativeTime(daysAgo(30), now)).toBe("1mo ago");
  });

  it("never reports zero years just short of a full year", () => {
    expect(formatRelativeTime(daysAgo(362), now)).toBe("1y ago");
    expect(formatRelativeTime(daysAgo(730), now)).toBe("2y ago");
  });
});
