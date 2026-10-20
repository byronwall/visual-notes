import { describe, expect, it } from "vitest";
import { fromHtml } from "~/lib/note-content/convert";
import {
  appendMarkdown,
  contentFromMarkdown,
  noteToMarkdown,
} from "./note-content";

describe("noteToMarkdown", () => {
  it("reads blocks when the note has them", () => {
    const content = fromHtml("<h2>Plan</h2><p>Use <strong>zoom</strong></p>");
    const markdown = noteToMarkdown({ content, html: "", markdown: "old" });
    expect(markdown).toBe("## Plan\n\nUse **zoom**");
  });

  it("prefers editor HTML over stale stored markdown for unmigrated notes", () => {
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
  it("parses markdown into blocks", () => {
    const content = contentFromMarkdown("# Title");
    expect(content.content?.[0].type).toBe("heading");
    expect(content.content?.[0].attrs?.id).toBeTruthy();
  });
});

describe("appendMarkdown", () => {
  it("appends new blocks without touching existing ones", () => {
    const content = fromHtml("<p>Existing</p>");
    const next = appendMarkdown(
      { content, html: "", markdown: "" },
      "## Log\n\nNew line",
    );
    expect(next.content?.[0]).toEqual(content.content?.[0]);
    expect(noteToMarkdown({ content: next, html: "", markdown: "" })).toBe(
      "Existing\n\n## Log\n\nNew line",
    );
  });
});
