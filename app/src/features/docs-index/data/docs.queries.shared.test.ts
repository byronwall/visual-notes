import { describe, expect, it } from "vitest";
import {
  buildDocsWhere,
  toIsoDateEnd,
  toIsoDateStart,
} from "./docs.queries.shared";

describe("docs date filters", () => {
  it("ignores malformed URL date ranges", () => {
    const where = buildDocsWhere({
      createdFrom: toIsoDateStart("not-a-date"),
      updatedTo: toIsoDateEnd("2026-99-99"),
    });

    expect(where).toEqual(buildDocsWhere({}));
  });

  it("ignores impossible calendar dates instead of rolling them over", () => {
    expect(toIsoDateStart("2026-02-31")).toBeUndefined();
    expect(toIsoDateEnd("2026-02-31")).toBeUndefined();
  });

  it("keeps valid date bounds at local start and end of day", () => {
    expect(toIsoDateStart("2026-05-10")).toBe(
      new Date("2026-05-10T00:00:00").toISOString(),
    );
    expect(toIsoDateEnd("2026-05-10")).toBe(
      new Date("2026-05-10T23:59:59.999").toISOString(),
    );
  });
});
