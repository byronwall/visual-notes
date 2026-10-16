import { describe, expect, it, vi } from "vitest";

vi.mock("@solidjs/router", () => ({ query: (fn: unknown) => fn }));
vi.mock("~/server/db", () => ({ prisma: {} }));

import { buildDocPreviewText } from "./docs.queries";

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
