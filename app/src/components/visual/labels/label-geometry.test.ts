import { describe, expect, it } from "vitest";
import {
  computeLabelBox,
  measureBoxOverlap,
  shiftLabelBoxIntoBounds,
  truncateLabelText,
  wrapRegionTitle,
} from "./label-geometry";

describe("truncateLabelText", () => {
  it("keeps short text and ellipsizes long text", () => {
    expect(truncateLabelText("Garden", 16)).toBe("Garden");
    expect(truncateLabelText("Supercalifragilistic", 8)).toBe("Superca…");
    expect(truncateLabelText("Anything", 1)).toBe("…");
  });
});

describe("wrapRegionTitle", () => {
  it("wraps words onto lines of at most maxChars", () => {
    expect(wrapRegionTitle("Machine learning reading list")).toEqual([
      "Machine learning",
      "reading list",
    ]);
  });

  it("folds the overflow into a truncated last line", () => {
    expect(
      wrapRegionTitle("One two three four five six seven eight nine", 9, 2),
    ).toEqual(["One two", "three fo…"]);
  });

  it("truncates a single long word", () => {
    expect(wrapRegionTitle("Supercalifragilisticexpialidocious", 10)).toEqual([
      "Supercali…",
    ]);
  });
});

describe("computeLabelBox", () => {
  const base = { textX: 100, topY: 50, labelWidth: 40, labelHeight: 20 };

  it("anchors the box by text-anchor", () => {
    const at = (textAnchor: "start" | "middle" | "end") =>
      computeLabelBox({ ...base, textAnchor, labelFontSize: 10 }).minX;
    expect(at("start")).toBe(100);
    expect(at("middle")).toBe(80);
    expect(at("end")).toBe(60);
  });

  it("puts the baseline 0.9 font sizes below the top", () => {
    const box = computeLabelBox({
      ...base,
      textAnchor: "start",
      labelFontSize: 10,
    });
    expect(box.textY).toBe(59);
    expect(box.maxY).toBe(70);
  });
});

describe("shiftLabelBoxIntoBounds", () => {
  it("moves a box back inside the bounds", () => {
    const box = computeLabelBox({
      textAnchor: "start",
      textX: 90,
      topY: -5,
      labelWidth: 20,
      labelHeight: 10,
      labelFontSize: 10,
    });
    const shifted = shiftLabelBoxIntoBounds(box, {
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
    });
    expect([shifted.minX, shifted.minY, shifted.maxX, shifted.maxY]).toEqual([
      80, 0, 100, 10,
    ]);
    expect(shifted.textY).toBe(box.textY + 5);
  });
});

describe("measureBoxOverlap", () => {
  it("is zero for separated boxes and the padded area otherwise", () => {
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    expect(
      measureBoxOverlap(box, [{ minX: 20, minY: 0, maxX: 30, maxY: 10 }], 0, 0),
    ).toBe(0);
    expect(
      measureBoxOverlap(box, [{ minX: 5, minY: 5, maxX: 15, maxY: 15 }], 0, 0),
    ).toBe(25);
    expect(
      measureBoxOverlap(box, [{ minX: 12, minY: 0, maxX: 20, maxY: 10 }], 3, 0),
    ).toBe(10);
  });
});
