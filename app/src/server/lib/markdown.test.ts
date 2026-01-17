import { describe, expect, it } from "vitest";
import { normalizeMarkdownToHtml, sanitizeHtmlContent } from "./markdown";

describe("sanitizeHtmlContent - URL handling", () => {
  it("preserves non-UTM query params in href and visible link text", () => {
    const url =
      "https://www.kayak.com/flights/IND-TPA/2026-05-21/2026-06-20-flexible-calendar-6to8?ucs=v95sme&sort=bestflight_a";

    const inputHtml = `<p><a href="${url}">${url}</a></p>`;
    const out = sanitizeHtmlContent(inputHtml);

    // sanitize-html will escape '&' as '&amp;' in both attributes and text
    expect(out).toContain("ucs=v95sme");
    expect(out).toContain("sort=bestflight_a");

    // Both href and visible text should include the full URL (with escaped '&')
    expect(out).toContain(`href="https://www.kayak.com/flights/IND-TPA/`);
    expect(out).toContain(`>https://www.kayak.com/flights/IND-TPA/`);

    // No duplicate URL fragments appended
    expect(out).not.toContain(`bestflight_a${url}`);
    expect(out).not.toContain(`ucs=v95sme&sort=bestflight_a${url}`);
    expect(out).not.toContain(`ucs=v95sme&amp;sort=bestflight_a${url}`);
  });

  it("strips utm_* params but preserves other query params and anchors", () => {
    const url =
      "https://example.com/path?utm_source=google&ucs=v95sme&utm_medium=cpc&sort=bestflight_a#section";

    const inputHtml = `<p><a href="${url}">${url}</a></p>`;
    const out = sanitizeHtmlContent(inputHtml);

    // UTM params are removed
    expect(out).not.toContain("utm_source=");
    expect(out).not.toContain("utm_medium=");

    // Non-UTM params and fragment are preserved
    expect(out).toContain("ucs=v95sme");
    expect(out).toContain("sort=bestflight_a");
    expect(out).toContain("#section");
  });

  it("is idempotent for anchors (does not duplicate URL text across multiple sanitization passes)", () => {
    const url =
      "https://www.kayak.com/flights/IND-TPA/2026-05-21/2026-06-20-flexible-calendar-6to8?ucs=v95sme&sort=bestflight_a";
    const inputHtml = `<p><a href="${url}">${url}</a></p>`;

    let out = inputHtml;
    for (let i = 0; i < 5; i += 1) {
      out = sanitizeHtmlContent(out);
    }

    const occurrences =
      out.split("https://www.kayak.com/flights/IND-TPA/").length - 1;
    expect(occurrences).toBe(2); // once in href, once in visible text
    expect(out).not.toContain(`bestflight_a${url}`);
    expect(out).not.toContain(`ucs=v95sme&sort=bestflight_a${url}`);
  });

  it("parses &amp; in href/text without corrupting query param keys", () => {
    const urlEscaped =
      "https://www.kayak.com/flights/IND-TPA/2026-05-21/2026-06-20-flexible-calendar-6to8?ucs=v95sme&amp;sort=bestflight_a";
    const inputHtml = `<p><a href="${urlEscaped}">${urlEscaped}</a></p>`;
    const out = sanitizeHtmlContent(inputHtml);

    // still should contain both intended query params
    expect(out).toContain("ucs=v95sme");
    expect(out).toContain("sort=bestflight_a");
    // `&amp;` is expected in serialized HTML; the key must remain `sort`, not `amp;sort`
    expect(out).not.toContain("amp%3Bsort=");
  });

  it("repairs previously-saved concatenated URLs in plain text (collapses repeated runs)", () => {
    const url =
      "https://www.kayak.com/flights/IND-TPA/2026-05-21/2026-06-20-flexible-calendar-6to8?ucs=v95sme&sort=bestflight_a";
    const crazy = `${url}${url}${url}${url}${url}${url}${url}`;

    const out = sanitizeHtmlContent(`<p>${crazy}</p>`);

    const occurrences =
      out.split("https://www.kayak.com/flights/IND-TPA/").length - 1;
    expect(occurrences).toBe(1);
    expect(out).toContain("ucs=v95sme");
    expect(out).toContain("sort=bestflight_a");
  });

  it("repairs previously-saved concatenated URLs inside anchor text", () => {
    const url =
      "https://www.kayak.com/flights/IND-TPA/2026-05-21/2026-06-20-flexible-calendar-6to8?ucs=v95sme&sort=bestflight_a";
    const crazy = `${url}${url}${url}`;

    const out = sanitizeHtmlContent(`<p><a href="${url}">${crazy}</a></p>`);

    // href should be intact
    expect(out).toContain("href=");

    // visible text should be collapsed to a single URL (escaped & is fine)
    const occurrences =
      out.split("https://www.kayak.com/flights/IND-TPA/").length - 1;
    expect(occurrences).toBe(2); // once in href, once in visible text
  });

  it("repairs concatenated links coming from markdown normalization (refresh/SSR path)", () => {
    const url =
      "https://www.kayak.com/flights/IND-TPA/2026-05-21/2026-06-20-flexible-calendar-6to8?ucs=v95sme&sort=bestflight_a";
    const crazy = `${url}${url}${url}${url}${url}${url}${url}`;

    const md = `Florida trip

Last day of school is May 21

Flight price detail

cheapest are Tue-Tue and mid week

Large peaks below are Fri-Fri Sat-Sat and Sun-Sun

Advice was to only book 1-3 months in advance. Prices will come down for summer travel later

Links

${crazy}
`;

    const out = normalizeMarkdownToHtml(md);

    // The classic broken pattern we saw in the UI: query tail glued to a new URL start.
    expect(out).not.toContain("bestflight_ahttps://");

    // Ensure the correct query params survived.
    expect(out).toContain("ucs=v95sme");
    expect(out).toContain("sort=bestflight_a");

    // Ensure we didn't keep multiple repeated occurrences of the same URL.
    const occurrences =
      out.split("https://www.kayak.com/flights/IND-TPA/").length - 1;
    expect(occurrences).toBeLessThanOrEqual(2); // href + visible text at most
  });
});
