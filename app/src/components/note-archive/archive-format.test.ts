import { describe, expect, it } from "vitest";
import { daysUntil, deletesInLabel, reasonVerb } from "./archive-format";

const now = Date.parse("2026-10-25T12:00:00Z");

describe("archive-format", () => {
  it("counts whole days left and never goes negative", () => {
    expect(daysUntil("2026-11-17T12:00:00Z", now)).toBe(23);
    expect(daysUntil("2026-10-01T00:00:00Z", now)).toBe(0);
  });

  it("labels the countdown", () => {
    expect(deletesInLabel("2026-10-25T18:00:00Z", now)).toBe(
      "deletes within a day",
    );
    expect(deletesInLabel("2026-10-20T00:00:00Z", now)).toBe(
      "deletes within a day",
    );
    expect(deletesInLabel("2026-11-24T12:00:00Z", now)).toBe(
      "deletes in 30 days",
    );
  });

  it("describes the archive reason", () => {
    expect(reasonVerb("distill")).toBe("distilled into");
    expect(reasonVerb(null)).toBe("archived");
  });
});
