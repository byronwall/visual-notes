import { describe, expect, it } from "vitest";
import {
  buildArchivePreferredImages,
  getArchiveCanvasDescription,
  getArchiveCanvasPosition,
  normalizeArchiveCanvasCardMode,
} from "./archive-canvas";

describe("buildArchivePreferredImages", () => {
  it("prefers note images before social preview images", () => {
    const images = buildArchivePreferredImages({
      noteImageUrls: [["https://notes.test/1.png"], ["https://notes.test/2.png"]],
      meta: {
        ogImage: "https://meta.test/og.png",
      },
      limit: 3,
    });

    expect(images).toEqual([
      "https://notes.test/1.png",
      "https://notes.test/2.png",
      "https://meta.test/og.png",
    ]);
  });

  it("deduplicates repeated URLs and caps the result length", () => {
    const images = buildArchivePreferredImages({
      noteImageUrls: [
        ["https://notes.test/shared.png", "https://notes.test/2.png"],
        ["https://notes.test/shared.png", "https://notes.test/3.png"],
      ],
      meta: {
        twitterImage: "https://notes.test/2.png",
      },
      limit: 2,
    });

    expect(images).toEqual([
      "https://notes.test/shared.png",
      "https://notes.test/2.png",
    ]);
  });
});

describe("getArchiveCanvasDescription", () => {
  it("prefers meta description and falls back to note text", () => {
    expect(
      getArchiveCanvasDescription({
        meta: {
          description: "Meta description",
        },
        noteText: "Latest note",
      }),
    ).toBe("Meta description");

    expect(
      getArchiveCanvasDescription({
        meta: null,
        noteText: "Latest note",
      }),
    ).toBe("Latest note");
  });
});

describe("getArchiveCanvasPosition", () => {
  it("returns stored position when present", () => {
    expect(
      getArchiveCanvasPosition({
        id: "page-1",
        title: "Saved page",
        index: 0,
        canvasX: 120,
        canvasY: -80,
      }),
    ).toEqual({ x: 120, y: -80 });
  });

  it("uses deterministic seeded positions when layout is missing", () => {
    const first = getArchiveCanvasPosition({
      id: "page-1",
      title: "Seeded page",
      index: 4,
      canvasX: null,
      canvasY: null,
    });
    const second = getArchiveCanvasPosition({
      id: "page-1",
      title: "Seeded page",
      index: 4,
      canvasX: null,
      canvasY: null,
    });

    expect(first).toEqual(second);
  });
});

describe("normalizeArchiveCanvasCardMode", () => {
  it("defaults invalid values to summary", () => {
    expect(normalizeArchiveCanvasCardMode("compact")).toBe("compact");
    expect(normalizeArchiveCanvasCardMode("invalid")).toBe("summary");
    expect(normalizeArchiveCanvasCardMode(undefined)).toBe("summary");
  });
});
