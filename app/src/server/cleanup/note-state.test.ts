import { describe, expect, it } from "vitest";
import { buildNoteState, cleanBody, findDates } from "./note-state";

const base = {
  title: "Cub Scout Camping Trip",
  path: null,
  createdAt: new Date("2026-08-01T12:00:00Z"),
  originalSource: null,
  createdByAgent: false,
  views30d: 0,
};
const today = new Date("2026-10-24T12:00:00Z");

describe("findDates", () => {
  it("reads ISO, US, and written dates and skips impossible ones", () => {
    expect(
      findDates(
        "2026-09-13, 9/14/2026, Sept 15, 2026, 16 Oct 2026, 2026-02-31",
      ),
    ).toEqual(["2026-09-13", "2026-09-14", "2026-09-15", "2026-10-16"]);
  });
});

describe("cleanBody", () => {
  it("drops images, data urls, and block id tags", () => {
    expect(
      cleanBody(
        "Intro ^abc123XYZ\n\n\n\n![a](x.png) data:image/png;base64,AAAA",
      ),
    ).toBe("Intro\n\n[image] [data]");
  });
});

describe("buildNoteState", () => {
  it("computes date facts in code", () => {
    const state = buildNoteState(
      { ...base, markdown: "Trip on Sep 13, 2026.\n\n## Packing list\n- tent" },
      today,
    );
    expect(state.facts).toMatchObject({
      source: "user",
      path: "(unfiled)",
      created: "2026-08-01",
      headings: 1,
      latestDateInBody: "2026-09-13",
      latestDateIsPast: true,
      truncated: false,
    });
  });

  it("detects ChatGPT transcripts and agent notes", () => {
    expect(
      buildNoteState(
        { ...base, markdown: "Q and A\n\nLink back: https://chatgpt.com/c/1" },
        today,
      ).facts.source,
    ).toBe("chatgpt_transcript");
    expect(
      buildNoteState({ ...base, createdByAgent: true, markdown: "x" }, today)
        .facts.source,
    ).toBe("agent");
  });

  it("sends head and tail of a long note", () => {
    const state = buildNoteState(
      { ...base, markdown: "a".repeat(30_000) },
      today,
    );
    expect(state.facts.truncated).toBe(true);
    expect(state.note.body).toContain("[… middle of note omitted …]");
    expect(state.note.body.length).toBeLessThan(21_000);
  });
});
