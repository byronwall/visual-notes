import { describe, expect, it } from "vitest";
import { type DashboardRun, previewText, runMatchesQuery, statsByPrompt } from "./ai-dashboard-model";

const run = (overrides: Partial<DashboardRun>): DashboardRun => ({
  id: "r1",
  status: "SUCCESS",
  model: "gpt-4o-mini",
  createdAt: "2026-10-17T10:00:00.000Z",
  promptId: "p1",
  promptTask: "summarize_note",
  ...overrides,
});

describe("statsByPrompt", () => {
  it("counts runs, failures, and the latest run per prompt", () => {
    const stats = statsByPrompt([
      run({ id: "a" }),
      run({ id: "b", status: "ERROR", createdAt: "2026-10-17T12:00:00.000Z" }),
      run({ id: "c", promptId: null }),
    ]);
    expect(stats.get("p1")).toEqual({ count: 2, failed: 1, lastRunAt: "2026-10-17T12:00:00.000Z" });
    expect(stats.size).toBe(1);
  });
});

describe("previewText", () => {
  it("flattens html and truncates", () => {
    expect(previewText("<ul><li><p>One</p></li><li><p>Two &amp; three</p></li></ul>")).toBe("One Two & three");
    expect(previewText("<p>abcdef</p>", 4)).toBe("abc…");
    expect(previewText(null)).toBe("");
  });
});

describe("runMatchesQuery", () => {
  it("matches task, model, and error text", () => {
    expect(runMatchesQuery(run({ error: "Rate limit" }), "rate")).toBe(true);
    expect(runMatchesQuery(run({}), "summarize")).toBe(true);
    expect(runMatchesQuery(run({}), "nope")).toBe(false);
  });
});
