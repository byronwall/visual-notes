import { describe, expect, it } from "vitest";
import { buildArchiveHtmlSnippet } from "./html-storage";
import { normalizeArchivedPageUrl } from "./url";

describe("normalizeArchivedPageUrl", () => {
  it("strips the hash but preserves query params", () => {
    const result = normalizeArchivedPageUrl(
      "https://example.com/path?a=1&b=2#section",
    );

    expect(result.normalizedUrl).toBe("https://example.com/path?a=1&b=2");
    expect(result.originalUrl).toBe(
      "https://example.com/path?a=1&b=2#section",
    );
    expect(result.hostname).toBe("example.com");
  });
});

describe("buildArchiveHtmlSnippet", () => {
  it("reduces HTML to a clean text snippet", () => {
    const snippet = buildArchiveHtmlSnippet(
      "<article><h1>Hello</h1><p>Archive <strong>this</strong> page.</p></article>",
      80,
    );

    expect(snippet).toBe("Hello Archive this page.");
  });
});

