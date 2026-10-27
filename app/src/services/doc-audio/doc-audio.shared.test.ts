import { describe, expect, it } from "vitest";
import {
  type TranscriptAnalysis,
  excerptSeconds,
  readableTranscriptError,
  segmentsBySection,
} from "./doc-audio.shared";

const segments = [
  { start: 1, end: 4, text: "All right, here's a couple of random ideas" },
  { start: 4, end: 7, text: "on the diagramming tool." },
  { start: 73, end: 75, text: "we should report that there's a crossing" },
  { start: 105, end: 106, text: "Oh, what else?" },
];

const section = (start: string) => ({
  title: start,
  summary: "",
  start,
  end: start,
  cleanedText: "",
});

describe("segmentsBySection", () => {
  it("keeps every segment, even ones before or between LLM ranges", () => {
    const analysis = {
      sections: [section("00:00:02.000"), section("00:01:44.500")],
    } as TranscriptAnalysis;
    const groups = segmentsBySection(analysis, segments);
    expect(groups.map((g) => g.map((s) => s.start))).toEqual([
      [1, 4, 73],
      [105],
    ]);
  });
});

describe("excerptSeconds", () => {
  it("finds an excerpt across segments, ignoring case and punctuation", () => {
    expect(excerptSeconds("Random ideas on the diagramming", segments)).toBe(1);
    expect(excerptSeconds("we should report that", segments)).toBe(73);
  });

  it("returns null for a paraphrase", () => {
    expect(excerptSeconds("report layout conflicts", segments)).toBeNull();
  });
});

describe("readableTranscriptError", () => {
  it("replaces a provider's JSON body with its message", () => {
    expect(
      readableTranscriptError(
        'whisper-1 413: {"error":{"message":"File too \\"big\\"","type":"x"}}',
      ),
    ).toBe('File too "big" (whisper-1 413)');
    expect(readableTranscriptError("No speech found")).toBe("No speech found");
  });
});
