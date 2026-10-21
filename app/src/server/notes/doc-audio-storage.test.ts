import { describe, expect, it } from "vitest";
import {
  audioFileNameFor,
  normalizeAudioMimeType,
  parseByteRange,
} from "./doc-audio-storage";

describe("doc audio storage", () => {
  it("normalizes recorder mime types", () => {
    expect(normalizeAudioMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeAudioMimeType("audio/mp4")).toBe("audio/mp4");
    expect(normalizeAudioMimeType("video/mp4")).toBeNull();
    expect(audioFileNameFor("abc123", "audio/mp4")).toBe("abc123.m4a");
  });

  it("parses byte ranges", () => {
    expect(parseByteRange(null, 100)).toBeNull();
    expect(parseByteRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 });
    expect(parseByteRange("bytes=10-", 100)).toEqual({ start: 10, end: 99 });
    expect(parseByteRange("bytes=-20", 100)).toEqual({ start: 80, end: 99 });
    expect(parseByteRange("bytes=0-500", 100)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange("bytes=100-", 100)).toBe("unsatisfiable");
  });
});
