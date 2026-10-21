import { describe, expect, it } from "vitest";
import type { DocItem } from "~/types/notes";
import {
  canvasMatchCountLabel,
  canvasSearchPlaceholder,
  matchCanvasDocs,
  normalizeCanvasQuery,
  parseCanvasSearchScope,
} from "./canvas-search";

const doc = (id: string, title: string, path?: string) =>
  ({ id, title, path, updatedAt: "2026-01-01" }) as DocItem;

const docs = [
  doc("a", "Code review habits", "software/practices"),
  doc("b", "Review of Dune"),
  doc("c", "Garden plan", "home/review"),
];

describe("matchCanvasDocs", () => {
  it("returns null without a query", () => {
    expect(matchCanvasDocs(docs, normalizeCanvasQuery("   "))).toBeNull();
  });

  it("matches title or path across every note by default", () => {
    const ids = matchCanvasDocs(docs, normalizeCanvasQuery(" REVIEW "))?.map(
      (d) => d.id,
    );
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("limits matches to the region's notes when scoped", () => {
    const ids = matchCanvasDocs(docs, "review", new Set(["a", "c"]))?.map(
      (d) => d.id,
    );
    expect(ids).toEqual(["a", "c"]);
  });

  it("returns an empty list when nothing in scope matches", () => {
    expect(matchCanvasDocs(docs, "dune", new Set(["a"]))).toEqual([]);
  });
});

describe("scope labels", () => {
  it("parses the URL scope, defaulting to global", () => {
    expect(parseCanvasSearchScope("region")).toBe("region");
    expect(parseCanvasSearchScope(undefined)).toBe("all");
    expect(parseCanvasSearchScope("bogus")).toBe("all");
  });

  it("says what is being searched", () => {
    expect(canvasSearchPlaceholder(null)).toBe("Search all notes");
    expect(canvasSearchPlaceholder("Software")).toBe("Search in Software");
    expect(canvasMatchCountLabel(1, false)).toBe("1 match");
    expect(canvasMatchCountLabel(1200, false)).toBe("1,200 matches");
    expect(canvasMatchCountLabel(12, true)).toBe("12 in region");
  });
});
