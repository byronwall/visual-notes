import { describe, expect, it } from "vitest";
import type { CollectionProperty } from "./types";
import {
  coerceValue,
  formatValueText,
  isEmptyValue,
  parseLooseText,
  validateValue,
} from "./values";

const prop = (
  kind: CollectionProperty["kind"],
  config: CollectionProperty["config"] = {},
): CollectionProperty => ({
  id: `p_${kind}`,
  name: kind,
  kind,
  config,
  position: 0,
});

const options = [
  {
    id: "o1",
    name: "Reading",
    color: "blue" as const,
    group: "doing" as const,
  },
  { id: "o2", name: "Done", color: "green" as const, group: "done" as const },
];

describe("validateValue", () => {
  it.each([
    ["text", "hello", "hello"],
    ["text", "", null],
    ["number", 3.5, 3.5],
    ["checkbox", true, true],
    ["checkbox", false, null],
  ] as const)("%s accepts %j", (kind, input, expected) => {
    expect(validateValue(prop(kind), input)).toEqual({
      ok: true,
      value: expected,
    });
  });

  it.each([
    ["text", 4],
    ["number", "4"],
    ["number", Number.NaN],
    ["checkbox", "yes"],
    ["date", "2026-10-19"],
    ["date", { start: "2026-13-01" }],
    ["date", { start: "2026-10-19", end: "2026-10-01" }],
    ["created_time", { start: "2026-10-19" }],
  ] as const)("%s rejects %j", (kind, input) => {
    expect(validateValue(prop(kind), input).ok).toBe(false);
  });

  it("checks option ids for select-like kinds", () => {
    expect(validateValue(prop("select", { options }), "o1").ok).toBe(true);
    expect(validateValue(prop("status", { options }), "nope").ok).toBe(false);
    expect(
      validateValue(prop("multi_select", { options }), ["o1", "o1"]),
    ).toEqual({
      ok: true,
      value: ["o1"],
    });
    expect(
      validateValue(prop("multi_select", { options }), ["o1", "x"]).ok,
    ).toBe(false);
  });

  it("bounds ratings", () => {
    const rating = prop("number", { format: "rating", ratingMax: 5 });
    expect(validateValue(rating, 5).ok).toBe(true);
    expect(validateValue(rating, 6).ok).toBe(false);
    expect(validateValue(rating, 2.5).ok).toBe(false);
  });

  it("accepts dates with time and ranges", () => {
    expect(
      validateValue(prop("date"), {
        start: "2026-10-19T09:30",
        end: "2026-10-20",
      }),
    ).toEqual({
      ok: true,
      value: { start: "2026-10-19T09:30", end: "2026-10-20" },
    });
  });

  it("always allows clearing", () => {
    expect(validateValue(prop("select", { options }), null)).toEqual({
      ok: true,
      value: null,
    });
  });
});

describe("formatValueText", () => {
  it("formats numbers by format", () => {
    expect(formatValueText(prop("number", { format: "percent" }), 0.25)).toBe(
      "25%",
    );
    expect(formatValueText(prop("number", { format: "currency" }), 12)).toBe(
      "$12.00",
    );
    expect(formatValueText(prop("number", { format: "rating" }), 4)).toBe(
      "4/5",
    );
  });

  it("formats options and dates", () => {
    expect(
      formatValueText(prop("multi_select", { options }), ["o1", "o2"]),
    ).toBe("Reading, Done");
    expect(
      formatValueText(prop("date"), { start: "2026-10-19", end: "2026-10-21" }),
    ).toBe("Oct 19, 2026 → Oct 21, 2026");
  });
});

describe("parseLooseText", () => {
  it("parses numbers, money, and percents", () => {
    expect(parseLooseText(prop("number"), "$1,200").value).toBe(1200);
    expect(parseLooseText(prop("number"), "40%").value).toBe(0.4);
    expect(parseLooseText(prop("number"), "abc").failed).toBe(true);
  });

  it("resolves option names and reports new ones", () => {
    expect(parseLooseText(prop("select", { options }), "reading")).toEqual({
      value: "o1",
      newOptions: [],
      failed: false,
    });
    expect(
      parseLooseText(prop("multi_select", { options }), "Done, Fresh"),
    ).toEqual({
      value: ["o2"],
      newOptions: ["Fresh"],
      failed: false,
    });
  });

  it("parses dates and checkboxes", () => {
    expect(
      parseLooseText(prop("date"), "2026-10-19 → 2026-10-22").value,
    ).toEqual({
      start: "2026-10-19",
      end: "2026-10-22",
    });
    expect(parseLooseText(prop("checkbox"), "yes").value).toBe(true);
    expect(parseLooseText(prop("checkbox"), "maybe").failed).toBe(true);
  });
});

describe("coerceValue", () => {
  it("keeps option ids between select and multi-select", () => {
    const select = prop("select", { options });
    const multi = prop("multi_select", { options });
    expect(coerceValue(select, multi, "o1")).toEqual({
      value: ["o1"],
      newOptions: [],
      lost: false,
    });
    expect(coerceValue(multi, select, ["o1", "o2"]).lost).toBe(true);
  });

  it("converts text to numbers and flags failures", () => {
    expect(coerceValue(prop("text"), prop("number"), "42").value).toBe(42);
    expect(coerceValue(prop("text"), prop("number"), "lots").lost).toBe(true);
  });

  it("converts numbers to text", () => {
    expect(coerceValue(prop("number"), prop("text"), 4).value).toBe("4");
  });
});

describe("isEmptyValue", () => {
  it("treats null, blanks, false, and empty lists as empty", () => {
    expect(
      [null, "", false, [], undefined].every((v) => isEmptyValue(v as never)),
    ).toBe(true);
    expect(isEmptyValue(0)).toBe(false);
  });
});
