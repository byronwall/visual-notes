import { describe, expect, it } from "vitest";
import { decideUmapRetrain, UMAP_RETRAIN_CONFIG } from "./umap.retrain-trigger";

const now = new Date("2026-10-21T00:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe("decideUmapRetrain", () => {
  it("retrains once new notes reach 20% of the map", () => {
    const decision = decideUmapRetrain(
      { trainedDocCount: 80, pointCount: 100, createdAt: daysAgo(1) },
      now,
    );
    expect(decision).toMatchObject({
      retrain: true,
      reason: "drift",
      newNotes: 20,
    });
  });

  it("waits just under the drift threshold", () => {
    const decision = decideUmapRetrain(
      { trainedDocCount: 81, pointCount: 100, createdAt: daysAgo(1) },
      now,
    );
    expect(decision.retrain).toBe(false);
  });

  it("needs a minimum count of new notes for a tiny map", () => {
    expect(
      decideUmapRetrain(
        { trainedDocCount: 6, pointCount: 10, createdAt: daysAgo(1) },
        now,
      ).retrain,
    ).toBe(false);
    expect(
      decideUmapRetrain(
        { trainedDocCount: 5, pointCount: 10, createdAt: daysAgo(1) },
        now,
      ).retrain,
    ).toBe(true);
  });

  it("retrains an old map with enough new notes", () => {
    const old = daysAgo(UMAP_RETRAIN_CONFIG.maxAgeDays);
    expect(
      decideUmapRetrain(
        { trainedDocCount: 990, pointCount: 1000, createdAt: old },
        now,
      ),
    ).toMatchObject({ retrain: true, reason: "age" });
    expect(
      decideUmapRetrain(
        { trainedDocCount: 991, pointCount: 1000, createdAt: old },
        now,
      ).retrain,
    ).toBe(false);
  });

  it("does not retrain a young map with few new notes", () => {
    expect(
      decideUmapRetrain(
        { trainedDocCount: 990, pointCount: 1000, createdAt: daysAgo(29) },
        now,
      ).retrain,
    ).toBe(false);
  });

  it("treats an unknown trained count as no new notes", () => {
    expect(
      decideUmapRetrain(
        { trainedDocCount: null, pointCount: 500, createdAt: daysAgo(90) },
        now,
      ),
    ).toMatchObject({ retrain: false, newNotes: 0 });
  });
});
