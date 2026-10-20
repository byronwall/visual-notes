import { describe, expect, it } from "vitest";
import { sanitizeHtmlContent } from "./markdown";

describe("collection view embeds", () => {
  it("survive sanitizing with their view id", () => {
    const html = '<p>hello</p><div data-collection-view="cmabc123"></div>';
    expect(sanitizeHtmlContent(html)).toContain('data-collection-view="cmabc123"');
  });

  it("keep no other div attributes", () => {
    expect(sanitizeHtmlContent('<div data-collection-view="x" onclick="evil()" style="color:red"></div>')).toBe(
      '<div data-collection-view="x"></div>',
    );
  });
});
