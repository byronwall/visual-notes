import { describe, expect, it, vi } from "vitest";
import { measureConversion } from "./block-migration";
import { toHtml, toPlainText } from "~/lib/note-content/convert";
import * as convert from "~/lib/note-content/convert";

vi.mock("~/server/db", () => ({ prisma: {} }));
vi.mock("./note-index", () => ({ rebuildNoteIndex: vi.fn() }));

const measure = (markdown: string, html = "") =>
  measureConversion({ id: "sample", title: "Sample", html, markdown });

describe("block migration text loss", () => {
  it("compares visible markdown text and keeps link destinations", () => {
    const url = "https://www.felixstocker.com/blog/talent";
    const result = measure(`On Talent\n=========\n\n[${url}](${url})\n\n===`);
    expect(result.beforeChars).toBe(51);
    expect(result.afterChars).toBe(51);
    expect(result.lossPct).toBe(0);
    expect(toHtml(result.content)).toContain(`href="${url}"`);
  });

  it("does not count image URLs, heading underlines or table syntax as text", () => {
    const src = `/api/doc-images/${"a".repeat(64)}.jpeg`;
    const result = measure(`Saved Photo\n===========\n\n![](${src})\n\n===`);
    expect(result.beforeChars).toBe(13);
    expect(result.afterChars).toBe(13);
    expect(result.lossPct).toBe(0);
    expect(
      result.content.content?.find((n) => n.type === "image")?.attrs?.src,
    ).toBe(src);
    expect(measure("| Name | Value |\n| --- | --- |\n| A | B |").lossPct).toBe(
      0,
    );
  });

  it("decodes HTML entities and ignores document metadata", () => {
    const result = measure(
      "stale markdown",
      "<html><head><title>Metadata</title></head><body><p>A &amp; B &lt; C</p></body></html>",
    );
    expect(result.beforeChars).toBe(5);
    expect(result.afterChars).toBe(5);
    expect(result.lossPct).toBe(0);
    expect(toPlainText(result.content)).toBe("A & B < C");
  });

  it("still reports visible text dropped by the block schema", () => {
    vi.spyOn(convert, "contentFromLegacy").mockReturnValueOnce(
      convert.fromHtml("<p>Keep</p>"),
    );
    const result = measure("", "<p>Keep Missing text</p>");
    expect(result.beforeChars).toBe(15);
    expect(result.afterChars).toBe(4);
    expect(result.lossPct).toBeGreaterThan(2);
  });
});
