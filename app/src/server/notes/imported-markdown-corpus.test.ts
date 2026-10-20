import { describe, expect, it, vi } from "vitest";
import { measureConversion } from "./block-migration";
import {
  importedMarkdownSamples,
  seededRandom,
  syntheticNote,
} from "./imported-markdown-corpus";

vi.mock("~/server/db", () => ({ prisma: {} }));
vi.mock("./note-index", () => ({ rebuildNoteIndex: vi.fn() }));

const measure = (markdown: string) =>
  measureConversion({ id: "sample", title: "Sample", html: "", markdown });

describe("imported markdown corpus", () => {
  it.each(importedMarkdownSamples.map((s) => [s.name, s.markdown]))(
    "migrates %s without reported text loss",
    (_name, markdown) => {
      const result = measure(markdown);
      expect(result.beforeChars).toBeGreaterThan(0);
      expect(result.lossPct).toBeLessThanOrEqual(2);
    },
  );

  it("migrates synthetic notes built from the corpus without loss", () => {
    const random = seededRandom(7);
    for (let i = 0; i < 40; i += 1) {
      expect(
        measure(syntheticNote(i, random).markdown).lossPct,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("generates the same notes for the same seed", () => {
    const a = seededRandom(1);
    const b = seededRandom(1);
    expect(syntheticNote(3, a)).toEqual(syntheticNote(3, b));
  });
});
