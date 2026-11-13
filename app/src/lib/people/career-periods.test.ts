import { describe, expect, it } from "vitest";
import {
  compareRoles,
  formatPartial,
  formatPeriod,
  isPartialDate,
  lastDay,
  periodProblem,
  type RolePeriod,
} from "./career-periods";

const role = (p: Partial<RolePeriod>) => ({
  status: "ended" as const,
  startOn: null,
  startApprox: false,
  endOn: null,
  endApprox: false,
  observedOn: null,
  recordedOn: "2026-11-01",
  ...p,
});

describe("partial dates", () => {
  it("accepts year, month, and real days only", () => {
    expect(["2011", "2011-07", "2024-02-29"].every(isPartialDate)).toBe(true);
    expect(["2011-13", "2023-02-29", "11-07", "2011-7"].some(isPartialDate)).toBe(
      false,
    );
  });

  it("shows a month as a month, never as its first day", () => {
    expect(formatPartial("2011-07")).toBe("Jul 2011");
    expect(formatPartial("2011", true)).toBe("c. 2011");
    expect(lastDay("2024-02")).toBe("2024-02-29");
  });

  it("labels an ended role with no end day and an undated listing honestly", () => {
    expect(formatPeriod(role({ startOn: "2015-03" }))).toBe(
      "Mar 2015 – end unknown",
    );
    expect(formatPeriod(role({ status: "unknown" }))).toBe("Dates unknown");
    expect(formatPeriod(role({ status: "current", startOn: "2020" }))).toBe(
      "2020 – present",
    );
  });

  it("rejects an end before the start and an end on a current role", () => {
    expect(periodProblem({ startOn: "2020-05", endOn: "2020-04" })).toBeTruthy();
    expect(periodProblem({ startOn: "2020-05", endOn: "2020-05" })).toBeNull();
    expect(periodProblem({ status: "current", endOn: "2020" })).toBeTruthy();
  });
});

describe("compareRoles", () => {
  it("finds an established overlap and states it in the roles' own precision", () => {
    const r = compareRoles(
      role({ startOn: "2016-03", endOn: "2019-07" }),
      role({ startOn: "2017-06", endOn: "2021-01" }),
    );
    expect(r).toMatchObject({ kind: "overlap", from: "Jun 2017", to: "Jul 2019" });
  });

  it("keeps a shared boundary month as possible", () => {
    const r = compareRoles(
      role({ startOn: "2015-01", endOn: "2017-06" }),
      role({ startOn: "2017-06", endOn: "2018-01" }),
    );
    expect(r.kind).toBe("possible");
  });

  it("reports separated periods, including a returning stint's gap", () => {
    const r = compareRoles(
      role({ startOn: "2010", endOn: "2012" }),
      role({ startOn: "2014-02", endOn: "2016" }),
    );
    expect(r.kind).toBe("none");
  });

  it("calls undated roles insufficient evidence", () => {
    const r = compareRoles(
      role({ status: "unknown" }),
      role({ startOn: "2014", endOn: "2016" }),
    );
    expect(r.kind).toBe("unknown");
  });

  it("limits a current claim to the day it was observed", () => {
    const current = role({
      status: "current",
      startOn: "2018-01",
      observedOn: "2020-06-01",
    });
    expect(
      compareRoles(current, role({ startOn: "2019-01", endOn: "2019-12" })).kind,
    ).toBe("overlap");
    // After the observation the claim proves nothing; it could have ended.
    expect(
      compareRoles(current, role({ startOn: "2023-01", endOn: "2024-01" })).kind,
    ).toBe("possible");
  });

  it("uses a start inside the other role's certain span as proof", () => {
    const r = compareRoles(
      role({ startOn: "2015", endOn: "2018" }),
      role({ startOn: "2017" }),
    );
    expect(r.kind).toBe("overlap");
  });

  it("widens approximate dates by one unit", () => {
    const r = compareRoles(
      role({ startOn: "2010", endOn: "2012", endApprox: true }),
      role({ startOn: "2013-02", endOn: "2015" }),
    );
    expect(r.kind).toBe("possible");
  });
});
