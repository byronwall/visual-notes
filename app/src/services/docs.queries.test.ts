import { describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({
  findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.map((id) => ({
      id,
      markdown: `Preview for ${id}`,
      html: "",
      path: null,
      meta: null,
    }))),
}));

vi.mock("@solidjs/router", () => ({ query: (fn: unknown) => fn }));
vi.mock("~/server/db", () => ({ prisma: { doc: { findMany } } }));

import { buildDocPreviewText, fetchDocPreviewsBatched } from "./docs.queries";

describe("buildDocPreviewText", () => {
  it("uses current HTML when imported Markdown is stale", () => {
    expect(
      buildDocPreviewText("Old imported prose", "<p>Current saved text</p>")
    ).toBe("Current saved text");
  });

  it.each(["<p></p>", '<img src="image.png">'])(
    "does not use stale Markdown when HTML has no preview text: %s",
    (html) => {
      expect(buildDocPreviewText("Old imported prose", html)).toBe(
        "No preview available."
      );
    }
  );

  it("uses Markdown when HTML is absent", () => {
    expect(buildDocPreviewText("# Imported prose")).toBe("Imported prose");
  });

  it("keeps the requested preview length", () => {
    expect(buildDocPreviewText("", "<p>Current saved text</p>", 7)).toBe(
      "Current"
    );
  });
});

describe("fetchDocPreviewsBatched", () => {
  it.each([120, 121, 200])(
    "returns every normalized unique preview for %i IDs in bounded ordered calls",
    async (count) => {
      findMany.mockClear();
      const ids = Array.from({ length: count }, (_, i) => `doc-${i + 1}`);
      const input = [
        ...ids.slice(0, Math.min(119, count)),
        ids[0],
        "",
        "   ",
        ...(count > 119 ? [` ${ids[119]} `] : []),
        ...ids.slice(120),
      ];
      const expected = Array.from(
        new Set(input.map((id) => id.trim()).filter(Boolean))
      );

      const previews = await fetchDocPreviewsBatched(input);
      const requested = findMany.mock.calls.flatMap(
        ([args]) => args.where.id.in
      );

      expect(findMany).toHaveBeenCalledTimes(Math.ceil(expected.length / 120));
      expect(
        findMany.mock.calls.every(([args]) => args.where.id.in.length <= 120)
      ).toBe(true);
      expect(requested).toEqual(expected);
      expect(previews.map((preview) => preview.id)).toEqual(expected);
    }
  );
});
