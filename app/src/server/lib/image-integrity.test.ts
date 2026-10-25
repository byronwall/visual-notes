import { describe, expect, it } from "vitest";
import { checkImageIntegrity } from "./image-integrity";

// 3x2 images written by macOS sips, one per stored format.
const FIXTURES: Record<string, string> = {
  png: "iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAA6ADAAQAAAABAAAAAgAAAABqvnfpAAAAFElEQVQIHWNkYPhfzwAFTDAGiAYAIiEBgrsG/REAAAAASUVORK5CYII=",
  jpg: "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAA6ADAAQAAAABAAAAAgAAAAD/wAARCAACAAMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwACAgICAgIDAgIDBQMDAwUGBQUFBQYIBgYGBgYICggICAgICAoKCgoKCgoKDAwMDAwMDg4ODg4PDw8PDw8PDw8P/9sAQwECAgIEBAQHBAQHEAsJCxAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ/90ABAAB/9oADAMBAAIRAxEAPwDuKKKK/wBAD5c//9k=",
  gif: "R0lGODdhAwACAJEAAAAAAAAA/////wAAACH5BAkAAAMAIf8LWE1QIERhdGFYTVD/PHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyI+CiAgICAgICAgIDxleGlmOkNvbG9yU3BhY2U+MTwvZXhpsmY6Q29sb3JTcGFjZT4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjM8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogICAgICAgICA8ZXhpZjpQaXhlbFlEaW1lbnNpb24+MjwvZXhpZjpQaXhlbFlEaW1lbnNpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgoALAAAAAADAAIAAAICjF8AOw==",
  bmp: "Qk2iAAAAAAAAAIoAAAB8AAAAAwAAAP7///8BACAAAwAAABgAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD/AAAAAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAf/8AAH//AAB//wAAf/8AAH//AAB/",
  heic: "AAAAGGZ0eXBoZWljAAAAAGhlaWNtaWYxAAAC3W1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAHBpY3QAAAAAAAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAADnBpdG0AAAAAAAEAAABNaWluZgAAAAAAAwAAABVpbmZlAgAAAAABAABodmMxAAAAABVpbmZlAgAAAQACAABodmMxAAAAABVpbmZlAgAAAQADAABFeGlmAAAAAChpcmVmAAAAAAAAAA5hdXhsAAIAAQABAAAADmNkc2MAAwABAAEAAAHPaXBycAAAAaRpcGNvAAAAE2NvbHJuY2x4AAIAAgAGgAAAAAxjbGxpAMsAQAAAABRpc3BlAAAAAAAAAAQAAAACAAAAKGNsYXAAAAADAAAAAQAAAAIAAAAB/8AAAACAAAAAAAAAAAAAAQAAAAlpcm90AAAAABBwaXhpAAAAAAMICAgAAAAOcGl4aQAAAAABCAAAADdhdXhDAAAAAHVybjptcGVnOmhldmM6MjAxNTphdXhpZDoxAAAAAAwAAAAITgGlBAAB/kAAAAByaHZjQwEDcAAAALAAAAAAAB7wAPz9+PgAAAsDoAABABdAAQwB//8DcAAAAwCwAAADAAADAB5wJKEAAQAkQgEBA3AAAAMAsAAAAwAAAwAeoBQgQcCfBBiHuRZVNwICBgCAogABAAlEAcBhcshEU2QAAABxaHZjQwEECAAAAL/IAAAAAB7wAPz8+PgAAAsDoAABABdAAQwB//8ECAAAAwC/yAAAAwAAHhcCQKEAAQAjQgEBBAgAAAMAv8gAAAMAAB7AUIEHATsH+IF7kWVTcCAgIAiiAAEACUQBwGHSyERTZAAAACNpcG1hAAAAAAAAAAIAAQeBAgMGiYSFAAIGAweIioSFAAAAOmlsb2MAAAAARAAAAwABAAAAAQAAA1MAAABWAAIAAAABAAADqQAAADMAAwAAAAEAAAMFAAAATgAAAAFtZGF0AAAAAAAAAOcAAAAGRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAA6ADAAQAAAABAAAAAgAAAAAAAABSKAGvo1UaYFVFoNp5EqB06nb3CH/ED//1jchRC43zxaH4v+S+a//j+il42ypjw7KAPUsUOf/12/2zhfS/OSo8Y91z44N0KorTrAJVCYXFzeYkpwAAAC8oAa9GgjW1bk+waMNeo59EpPJ94/KjvHs/0M160IAZm/vnjON2IGAMh4xL7/2TgA==",
};

describe("checkImageIntegrity", () => {
  for (const [ext, base64] of Object.entries(FIXTURES)) {
    const whole = Buffer.from(base64, "base64");

    it(`accepts a whole ${ext} and reads its size`, () => {
      const check = checkImageIntegrity(whole, ext);
      expect(check.ok).toBe(true);
      if (check.ok && ext !== "heic") expect([check.width, check.height]).toEqual([3, 2]);
    });

    it(`refuses a ${ext} cut off part way`, () => {
      for (const keep of [0.5, 0.9]) {
        const check = checkImageIntegrity(whole.subarray(0, Math.floor(whole.length * keep)), ext);
        expect(check).toMatchObject({ ok: false, problem: expect.stringMatching(/cut off/) });
      }
    });
  }

  it("refuses base64 that stopped early, the way a long agent payload breaks", () => {
    const base64 = FIXTURES.jpg!;
    const truncated = Buffer.from(base64.slice(0, base64.length - 40), "base64");
    expect(checkImageIntegrity(truncated, "jpg").ok).toBe(false);
  });

  it("accepts a JPEG with stray bytes between segments, as decoders do", () => {
    const whole = Buffer.from(FIXTURES.jpg!, "base64");
    const stray = Buffer.concat([whole.subarray(0, 2), Buffer.from([0x00, 0x0a, 0x00]), whole.subarray(2)]);
    expect(checkImageIntegrity(stray, "jpg")).toEqual({ ok: true, width: 3, height: 2 });
  });

  it("accepts a GIF with extra data after its trailer or last frame", () => {
    const whole = Buffer.from(FIXTURES.gif!, "base64");
    const junk = Buffer.concat([whole, Buffer.from("trailing metadata")]);
    expect(checkImageIntegrity(junk, "gif")).toEqual({ ok: true, width: 3, height: 2 });
    const noTrailer = Buffer.concat([whole.subarray(0, whole.length - 1), Buffer.from([0x99, 0x01])]);
    expect(checkImageIntegrity(noTrailer, "gif").ok).toBe(true);
  });

  it("refuses a GIF cut off inside its only frame", () => {
    const whole = Buffer.from(FIXTURES.gif!, "base64");
    expect(checkImageIntegrity(whole.subarray(0, whole.length - 3), "gif")).toMatchObject({ ok: false });
  });

  it("refuses a WebP shorter than its RIFF size", () => {
    const header = Buffer.alloc(30);
    header.write("RIFF", 0, "ascii");
    header.writeUInt32LE(100, 4);
    header.write("WEBPVP8X", 8, "ascii");
    expect(checkImageIntegrity(header, "webp").ok).toBe(false);
    header.writeUInt32LE(22, 4);
    header.writeUIntLE(2, 24, 3);
    header.writeUIntLE(1, 27, 3);
    expect(checkImageIntegrity(header, "webp")).toEqual({ ok: true, width: 3, height: 2 });
  });
});
