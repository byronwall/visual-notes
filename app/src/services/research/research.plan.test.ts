import { describe, expect, it } from "vitest";
import {
  ingestPayloadSchema,
  type IngestPayloadInput,
} from "./research.payload";
import { planIngest } from "./research.plan";

const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};

const plan = (input: Partial<IngestPayloadInput>, existing: string[] = []) =>
  planIngest(
    ingestPayloadSchema.parse({ batchKey: "b1", agent: "test", ...input }),
    {
      existingIds: new Set(existing),
      newId: ids(),
    },
  );

describe("planIngest", () => {
  it("flattens a nested tree in pre-order with parents and positional refs", () => {
    const result = plan(
      {
        under: "q1",
        cards: [
          {
            type: "finding",
            title: "Pin stops moves",
            children: [
              {
                type: "source",
                title: "Async book",
                url: " https://example.test ",
              },
              { type: "question", title: "When is Unpin implied?" },
            ],
          },
          { type: "task", title: "Read RFC", ref: "rfc" },
        ],
      },
      ["q1"],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { cards, refs } = result.plan;
    expect(cards.map((c) => [c.title, c.parentId])).toEqual([
      ["Pin stops moves", "q1"],
      ["Async book", refs.$0],
      ["When is Unpin implied?", refs.$0],
      ["Read RFC", "q1"],
    ]);
    expect(refs["$0.1"]).toBe(cards[2].id);
    expect(refs.rfc).toBe(refs.$1);
    expect(cards[1].url).toBe("https://example.test");
  });

  it("defaults tasks and questions to open and leaves info cards stateless", () => {
    const result = plan({
      cards: [
        { type: "task", title: "t" },
        { type: "question", title: "q", state: "done" },
        { type: "finding", title: "f" },
      ],
    });
    expect(result.ok && result.plan.cards.map((c) => c.state)).toEqual([
      "open",
      "done",
      null,
    ]);
  });

  it("collects every problem in one pass", () => {
    const result = plan({
      under: "missing",
      cards: [
        { type: "finding", title: "a", ref: "x", state: "open" },
        { type: "finding", title: "b", ref: "x" },
      ],
      links: [
        { from: "x", to: "nope" },
        { from: "$0", to: "$0" },
      ],
      summaries: [{ title: "s", covers: ["$9"] }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      'under: no card "missing" in this topic',
      "$0: state only applies to task and question cards (got finding)",
      '$1: duplicate ref "x"',
      'links.0.to: unknown ref "nope"',
      "links.1: a card cannot link to itself",
      'summaries.0.covers.0: unknown ref "$9"',
    ]);
  });

  it("resolves links and summaries against existing ids and earlier summaries", () => {
    const result = plan(
      {
        cards: [{ type: "finding", title: "new" }],
        links: [{ from: "$0", to: "old" }],
        summaries: [
          { title: "Inner", ref: "inner", covers: ["$0", "old", "$0"] },
          { title: "Outer", covers: ["inner"] },
        ],
      },
      ["old"],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [inner, outer] = result.plan.summaries;
    expect(inner.memberIds).toEqual([result.plan.refs.$0, "old"]);
    expect(outer.memberIds).toEqual([inner.card.id]);
    expect(inner.card.type).toBe("summary");
    expect(result.plan.links[0]).toMatchObject({
      fromId: result.plan.refs.$0,
      toId: "old",
    });
  });

  it("does not treat positional refs as existing ids", () => {
    const result = plan({ links: [{ from: "$0", to: "a" }] }, ["$0", "a"]);
    expect(result.ok).toBe(false);
  });

  it("rejects an empty payload", () => {
    const result = plan({});
    expect(!result.ok && result.errors).toEqual([
      "payload is empty: add cards, links, or summaries",
    ]);
  });
});

describe("ingestPayloadSchema", () => {
  it("rejects summary cards inside cards with a pointer to summaries", () => {
    const parsed = ingestPayloadSchema.safeParse({
      batchKey: "b",
      agent: "a",
      cards: [{ type: "summary", title: "x" }],
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0].message).toContain(
      'put summaries in "summaries"',
    );
  });

  it("reserves $ for positional refs", () => {
    const parsed = ingestPayloadSchema.safeParse({
      batchKey: "b",
      agent: "a",
      cards: [{ type: "task", title: "x", ref: "$x" }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("planIngest kinds, streams, and fields", () => {
  const kinds = [
    {
      key: "carrier",
      label: "Carrier",
      role: "option" as const,
      fields: [{ key: "price", label: "Price" }],
    },
  ];
  const planWith = (
    input: Partial<IngestPayloadInput>,
    nextSortOrder?: (parentId: string | null) => number,
  ) =>
    planIngest(
      ingestPayloadSchema.parse({ batchKey: "b1", agent: "test", ...input }),
      {
        existingIds: new Set(["q1"]),
        newId: ids(),
        streams: new Map([["pick", "s1"]]),
        kinds,
        nextSortOrder,
      },
    );

  it("takes the role from a declared kind and stores fields as text", () => {
    const result = planWith({
      cards: [
        {
          kind: "carrier",
          title: "Carrier A",
          gist: " Cheapest. ",
          stream: "pick",
          fields: { price: 332, note: "x", gone: null },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.cards[0]).toMatchObject({
      type: "option",
      kind: "carrier",
      gist: "Cheapest.",
      streamId: "s1",
      fields: { price: "332", note: "x" },
    });
    expect(result.plan.warnings).toEqual([
      "fields not declared on their kind were kept: carrier.note",
    ]);
  });

  it("rejects unknown kinds and streams and a kind/type mismatch, naming what is declared", () => {
    const result = planWith({
      cards: [
        { kind: "printer", title: "A" },
        { type: "finding", kind: "carrier", title: "B" },
        { type: "finding", title: "C", stream: "nope" },
        { title: "D" },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      '$0: unknown kind "printer" (declared: carrier)',
      '$1: kind "carrier" is a option, not a finding',
      '$2: unknown stream "nope" (declared: pick)',
      "$3: give a type or a declared kind",
    ]);
  });

  it("keeps link kinds and appends new siblings after existing ones", () => {
    const result = planWith(
      {
        under: "q1",
        cards: [
          { type: "finding", title: "A", ref: "a" },
          { type: "source", title: "S", ref: "s" },
        ],
        links: [
          { from: "s", to: "a", kind: "supports" },
          { from: "a", to: "q1" },
        ],
      },
      (parentId) => (parentId === "q1" ? 5 : 0),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.cards.map((card) => card.sortOrder)).toEqual([5, 6]);
    expect(result.plan.links.map((link) => link.kind)).toEqual([
      "supports",
      "relates_to",
    ]);
  });
});
