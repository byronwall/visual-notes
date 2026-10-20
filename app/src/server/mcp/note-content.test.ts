import { describe, expect, it } from "vitest";
import {
  appendMarkdown,
  contentFromMarkdown,
  noteToMarkdown,
} from "./note-content";

describe("noteToMarkdown", () => {
  it("prefers editor HTML over stale stored markdown", () => {
    const markdown = noteToMarkdown({
      html: "<h2>Plan</h2><p>Use <strong>zoom</strong></p>",
      markdown: "old text",
    });
    expect(markdown).toBe("## Plan\n\nUse **zoom**");
  });

  it("falls back to markdown for notes never saved from the editor", () => {
    expect(noteToMarkdown({ html: "", markdown: "- oats\n" })).toBe("- oats");
  });
});

describe("contentFromMarkdown", () => {
  it("stores markdown and rendered HTML together", () => {
    const content = contentFromMarkdown("# Title");
    expect(content.markdown).toBe("# Title");
    expect(content.html).toContain("<h1");
  });
});

describe("appendMarkdown", () => {
  it("appends rendered HTML without re-rendering existing content", () => {
    const existing = '<p data-keep="1">Existing</p>';
    const next = appendMarkdown(
      { html: existing, markdown: "" },
      "## Log\n\nNew line",
    );
    expect(next.html.startsWith(existing)).toBe(true);
    expect(next.html).toContain("New line");
    expect(next.markdown).toBe("Existing\n\n## Log\n\nNew line");
  });
});
