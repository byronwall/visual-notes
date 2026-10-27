import { describe, expect, it } from "vitest";
import { bucketFor } from "./buckets";
import type { Answers } from "./decide";
import type { NoteFacts } from "./note-state";

const facts: NoteFacts = {
  source: "user",
  path: "(unfiled)",
  created: "2026-01-01",
  words: 400,
  headings: 2,
  links: 0,
  views30d: 0,
  latestDateInBody: null,
  latestDateIsPast: null,
  truncated: false,
  linkUrl: null,
  recordings: 0,
};

const answers = (overrides: Answers = {}): Answers => ({
  copied_or_generated: { p: 0.2 },
  author_specific: { p: 0.7 },
  empty_or_stub: { p: 0.05 },
  import_junk: { p: 0.05 },
  is_todo: { p: 0.1 },
  worth_reading: { p: 0.8 },
  time_anchor: {
    choice: "ongoing_reference",
    probs: { ongoing_reference: 0.9, one_event: 0.05, period_plan: 0.05 },
  },
  ...overrides,
});

describe("bucketFor", () => {
  it("keeps a note the owner wrote", () => {
    expect(bucketFor(facts, answers()).bucket).toBe("keep");
  });

  it("sends stubs and import junk to delete, using the max flag", () => {
    expect(bucketFor(facts, answers({ import_junk: { p: 0.9 } }))).toEqual({
      bucket: "delete",
      confidence: 0.9,
    });
  });

  it("flags a passed one-time event only when code says the date is past", () => {
    const event = answers({
      time_anchor: {
        choice: "one_event",
        probs: { one_event: 0.8, period_plan: 0.1 },
      },
    });
    expect(bucketFor(facts, event).bucket).toBe("keep");
    expect(bucketFor({ ...facts, latestDateIsPast: true }, event).bucket).toBe(
      "post_event",
    );
  });

  it("needs is_todo at 0.8 for make-task", () => {
    expect(bucketFor(facts, answers({ is_todo: { p: 0.75 } })).bucket).toBe(
      "keep",
    );
    expect(bucketFor(facts, answers({ is_todo: { p: 0.85 } })).bucket).toBe(
      "make_task",
    );
  });

  it("ranks the distill queue by copied_or_generated with a ChatGPT nudge", () => {
    const copied = answers({ copied_or_generated: { p: 0.9 } });
    expect(bucketFor(facts, copied)).toEqual({
      bucket: "distill",
      confidence: 0.9,
    });
    expect(
      bucketFor({ ...facts, source: "chatgpt_transcript" }, copied).confidence,
    ).toBeCloseTo(0.93);
  });

  it("keeps a saved link out of delete unless the link is dead", () => {
    const stub = answers({ empty_or_stub: { p: 0.95 } });
    const linkFacts = { ...facts, linkUrl: "https://example.com/post" };
    const check = (status: "ok" | "dead" | "blocked") => ({
      url: linkFacts.linkUrl,
      status,
      httpStatus: null,
      title: null,
      checkedAt: "2026-10-26T00:00:00Z",
    });
    expect(bucketFor(linkFacts, stub).bucket).toBe("revisit_link");
    expect(
      bucketFor({ ...linkFacts, link: check("blocked") }, stub).bucket,
    ).toBe("revisit_link");
    expect(bucketFor({ ...linkFacts, link: check("dead") }, stub).bucket).toBe(
      "delete",
    );
    expect(bucketFor(linkFacts, answers({ is_todo: { p: 0.9 } })).bucket).toBe(
      "make_task",
    );
  });

  it("deletes generic notes not worth reading", () => {
    expect(
      bucketFor(
        facts,
        answers({ worth_reading: { p: 0.1 }, author_specific: { p: 0.1 } }),
      ).bucket,
    ).toBe("delete");
  });

  it("keeps a voice note: archiving would purge its recording", () => {
    const stub = answers({ empty_or_stub: { p: 0.95 }, is_todo: { p: 0.9 } });
    expect(bucketFor({ ...facts, words: 3, recordings: 1 }, stub).bucket).toBe(
      "keep",
    );
  });
});
