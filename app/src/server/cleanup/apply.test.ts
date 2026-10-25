import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ prisma: {} }));
vi.mock("~/server/notes/create-note", () => ({ createNoteRecord: vi.fn() }));
vi.mock("~/server/notes/note-archive", () => ({ archiveNotes: vi.fn() }));
vi.mock("~/server/notes/note-write", () => ({ writeNoteContent: vi.fn() }));

import { resultMarkdown } from "./apply";

const when = new Date("2026-10-25T12:00:00Z");

describe("resultMarkdown", () => {
  it("adds a source line to a new note", () => {
    expect(
      resultMarkdown({
        markdown: "- Use transform\n",
        sourceTitles: ["CSS Animations"],
        reason: "distill",
        when,
      }),
    ).toBe(
      "- Use transform\n\n_Distilled from “CSS Animations” on Oct 25, 2026._",
    );
  });

  it("puts appended content under a heading and names every source", () => {
    expect(
      resultMarkdown({
        markdown: "- a",
        sourceTitles: ["One", "Two"],
        reason: "combine",
        heading: "Motion",
        when,
      }),
    ).toBe("## Motion\n\n- a\n\n_Combined from “One”, “Two” on Oct 25, 2026._");
  });
});
