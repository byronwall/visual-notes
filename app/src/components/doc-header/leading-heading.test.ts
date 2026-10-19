import { describe, expect, it } from "vitest";
import { leadingH1Text, titlesMatch } from "./leading-heading";
import { formatRelativeShort } from "./relative-time";

describe("leadingH1Text", () => {
  it("reads the H1 that opens the note, decoding entities and marks", () => {
    expect(leadingH1Text("<h1>Plans &amp; <em>notes</em></h1><p>x</p>")).toBe(
      "Plans & notes",
    );
  });

  it("ignores an H1 that is not the first block", () => {
    expect(leadingH1Text("<p>intro</p><h1>Later</h1>")).toBeUndefined();
  });

  it("returns undefined for an empty heading", () => {
    expect(leadingH1Text("<h1></h1><p></p>")).toBeUndefined();
  });
});

describe("titlesMatch", () => {
  it("compares titles ignoring extra whitespace", () => {
    expect(titlesMatch(" A  title", "A title ")).toBe(true);
    expect(titlesMatch("A title", "Another")).toBe(false);
    expect(titlesMatch(undefined, "A")).toBe(false);
  });
});

describe("formatRelativeShort", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  it("labels recent saves compactly", () => {
    expect(formatRelativeShort(now, "2026-10-16T11:59:50Z")).toBe("just now");
    expect(formatRelativeShort(now, "2026-10-16T11:55:00Z")).toBe("5m ago");
    expect(formatRelativeShort(now, "2026-10-16T09:00:00Z")).toBe("3h ago");
    expect(formatRelativeShort(now, "2026-10-13T12:00:00Z")).toBe("3d ago");
  });
});
