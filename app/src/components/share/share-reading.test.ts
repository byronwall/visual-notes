import { describe, expect, it } from "vitest";
import {
  addHeadingAnchors,
  formatShareDate,
  prepareShareHtml,
  readingMinutes,
  stripLeadingTitleHeading,
} from "./share-reading";

describe("stripLeadingTitleHeading", () => {
  it("removes a leading h1 that repeats the title", () => {
    expect(
      stripLeadingTitleHeading("<h1>Trip — Notes</h1><p>Body</p>", "Trip - notes"),
    ).toBe("<p>Body</p>");
  });

  it("keeps an h1 that differs from the title", () => {
    const html = "<h1>Intro</h1><p>Body</p>";
    expect(stripLeadingTitleHeading(html, "Trip")).toBe(html);
  });

  it("keeps an h1 that is not the first block", () => {
    const html = "<p>Lead</p><h1>Trip</h1>";
    expect(stripLeadingTitleHeading(html, "Trip")).toBe(html);
  });
});

describe("addHeadingAnchors", () => {
  it("adds unique ids to h2 and h3 and builds an outline", () => {
    const { html, outline } = addHeadingAnchors(
      "<h2>Gear</h2><h3>Tent <em>setup</em></h3><h2>Gear</h2>",
    );
    expect(html).toBe(
      "<h2 id=\"gear\">Gear</h2><h3 id=\"tent-setup\">Tent <em>setup</em></h3><h2 id=\"gear-2\">Gear</h2>",
    );
    expect(outline).toEqual([
      { id: "gear", text: "Gear", level: 2 },
      { id: "tent-setup", text: "Tent setup", level: 3 },
      { id: "gear-2", text: "Gear", level: 2 },
    ]);
  });

  it("leaves headings that already have ids alone", () => {
    const html = "<h2 id=\"x\">Gear</h2>";
    expect(addHeadingAnchors(html)).toEqual({ html, outline: [] });
  });
});

describe("prepareShareHtml", () => {
  it("counts words after stripping the duplicated title", () => {
    const prepared = prepareShareHtml("<h1>Title</h1><p>one two three</p>", "Title");
    expect(prepared.wordCount).toBe(3);
    expect(prepared.html).toBe("<p>one two three</p>");
  });
});

describe("readingMinutes", () => {
  it("never returns less than one minute", () => {
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(660)).toBe(3);
  });
});

describe("formatShareDate", () => {
  it("formats in UTC", () => {
    expect(formatShareDate("2026-10-16T23:57:17.821Z")).toBe("Oct 16, 2026");
    expect(formatShareDate("nope")).toBe("");
  });
});
