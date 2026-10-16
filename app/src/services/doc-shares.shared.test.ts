import { describe, expect, it } from "vitest";
import {
  isDocShareDeleteAcknowledged,
  isDocShareSelectionCurrent,
  isDocShareUpsertAcknowledged,
} from "./doc-shares.shared";

describe("doc share action acknowledgments", () => {
  it("accepts only a usable share returned by upsert", () => {
    expect(
      isDocShareUpsertAcknowledged({
        id: "share-1",
        slug: "public-note",
        shareUrl: "/share/public-note",
        createdAt: "2026-10-16T00:00:00.000Z",
        updatedAt: "2026-10-16T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(isDocShareUpsertAcknowledged(undefined)).toBe(false);
    expect(
      isDocShareUpsertAcknowledged({
        id: "share-1",
        slug: "public-note",
        shareUrl: "/share/other-note",
        createdAt: "2026-10-16T00:00:00.000Z",
        updatedAt: "2026-10-16T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("accepts delete only when the server confirms the submitted document", () => {
    expect(
      isDocShareDeleteAcknowledged({ ok: true, docId: "doc-1" }, "doc-1"),
    ).toBe(true);
    expect(isDocShareDeleteAcknowledged(undefined, "doc-1")).toBe(false);
    expect(
      isDocShareDeleteAcknowledged({ ok: true, docId: "doc-2" }, "doc-1"),
    ).toBe(false);
  });
});

describe("doc share selection identity", () => {
  it("rejects late work after A→B→A or owner disposal", () => {
    const submitted = { docId: "A", generation: 0 };

    expect(
      isDocShareSelectionCurrent(
        submitted,
        { docId: "A", generation: 0 },
        false,
      ),
    ).toBe(true);
    expect(
      isDocShareSelectionCurrent(
        submitted,
        { docId: "A", generation: 2 },
        false,
      ),
    ).toBe(false);
    expect(
      isDocShareSelectionCurrent(
        submitted,
        { docId: "A", generation: 0 },
        true,
      ),
    ).toBe(false);
  });
});
