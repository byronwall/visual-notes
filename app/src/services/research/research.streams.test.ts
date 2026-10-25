import { describe, expect, it } from "vitest";
import { buildRelations } from "./research.relations";
import { assignStreams, lintTopic, UNSORTED_ID } from "./research.streams";
import type {
  ResearchCard,
  ResearchCardType,
  ResearchLink,
  ResearchStream,
} from "./research.types";

let order = 0;
const card = (
  id: string,
  type: ResearchCardType,
  extra: Partial<ResearchCard> = {},
): ResearchCard => ({
  id,
  type,
  title: id,
  gist: "",
  body: "",
  kind: null,
  fields: {},
  streamId: null,
  state: type === "question" || type === "task" ? "open" : null,
  url: null,
  snippet: null,
  imageUrl: null,
  parentId: null,
  sortOrder: order++,
  nudgeX: null,
  nudgeY: null,
  batchId: null,
  createdAt: "2026-10-24T00:00:00.000Z",
  updatedAt: "2026-10-24T00:00:00.000Z",
  ...extra,
});
const stream = (id: string, sortOrder: number): ResearchStream => ({
  id,
  key: id,
  title: `Stream ${id}`,
  goal: "",
  answer: "",
  sortOrder,
  batchId: null,
  createdAt: "2026-10-24T00:00:00.000Z",
  updatedAt: "2026-10-24T00:00:00.000Z",
});
const link = (
  fromId: string,
  toId: string,
  kind = "relates_to",
): ResearchLink => ({ id: `${fromId}-${toId}`, fromId, toId, kind });

describe("assignStreams", () => {
  it("inherits a stream from the nearest came-from ancestor and leaves the rest unsorted", () => {
    const cards = [
      card("q1", "question", { streamId: "b" }),
      card("f1", "finding", { parentId: "q1" }),
      card("f2", "finding", { parentId: "f1", streamId: "a" }),
      card("loose", "finding"),
      card("crit", "criterion"),
    ];
    const result = assignStreams({
      cards,
      links: [],
      streams: [stream("b", 1), stream("a", 0)],
    });
    expect(result.columns.map((column) => column.id)).toEqual(["a", "b"]);
    expect(Object.fromEntries(result.streamOf)).toEqual({
      q1: "b",
      f1: "b",
      f2: "a",
      loose: UNSORTED_ID,
      crit: UNSORTED_ID,
    });
    expect(result.topicCriteria.map((c) => c.id)).toEqual(["crit"]);
  });

  it("falls back to one virtual column per root question/task/option/finding", () => {
    const cards = [
      card("q1", "question"),
      card("f1", "finding", { parentId: "q1" }),
      card("c1", "criterion"),
      card("s1", "source", { parentId: "c1" }),
    ];
    const result = assignStreams({ cards, links: [], streams: [] });
    expect(result.columns).toMatchObject([
      { id: "root:q1", virtual: true, title: "q1" },
    ]);
    expect(result.streamOf.get("f1")).toBe("root:q1");
    expect(result.streamOf.get("s1")).toBe(UNSORTED_ID);
  });
});

describe("buildRelations", () => {
  it("reads answers, results, blockers, and citations from parents and typed links", () => {
    const cards = [
      card("q1", "question"),
      card("f1", "finding", { parentId: "q1" }),
      card("f1a", "finding", { parentId: "f1" }),
      card("t1", "task"),
      card("r1", "finding", { parentId: "t1" }),
      card("o1", "option"),
      card("s1", "source", { parentId: "f1" }),
      card("s2", "source"),
      card("f2", "finding"),
    ];
    const links = [
      link("o1", "q1", "blocks"),
      link("t1", "o1"),
      link("s2", "f2", "supports"),
      link("f2", "q1", "answers"),
    ];
    const relations = buildRelations({ cards, links });
    expect(relations.answers.get("q1")?.map((c) => c.id)).toEqual(["f1", "f2"]);
    expect(relations.answers.get("f1")?.map((c) => c.id)).toEqual(["f1a"]);
    expect(relations.results.get("t1")?.map((c) => c.id)).toEqual(["r1"]);
    expect(
      relations.blockers.get("o1")?.map((b) => [b.card.id, b.kind]),
    ).toEqual([
      ["q1", "blocks"],
      ["t1", "relates_to"],
    ]);
    expect(relations.citations.get("f1")?.map((c) => c.id)).toEqual(["s1"]);
    expect([...relations.citedSources].sort()).toEqual(["s1", "s2"]);
  });
});

describe("lintTopic", () => {
  it("flags the shapes from the production audit: parking-lot criteria, fan-out, loose sources, long titles", () => {
    const sources = Array.from({ length: 10 }, (_, i) =>
      card(`s${i}`, "source", { parentId: "crit" }),
    );
    const fan = Array.from({ length: 9 }, (_, i) =>
      card(`o${i}`, "option", { parentId: "q1" }),
    );
    const cards = [
      card("q1", "question", { title: "x".repeat(120), body: "y".repeat(400) }),
      card("crit", "criterion"),
      ...sources,
      ...fan,
      ...Array.from({ length: 3 }, (_, i) => card(`loose${i}`, "source")),
    ];
    const warnings = lintTopic({ cards, links: [], streams: [] });
    expect(
      warnings.some((w) => w.startsWith("This topic declares no streams")),
    ).toBe(true);
    expect(warnings.some((w) => w.includes("over 80 characters"))).toBe(true);
    expect(warnings.some((w) => w.includes('no "gist"'))).toBe(true);
    expect(warnings.some((w) => w.includes("has 9 cards under it"))).toBe(true);
    expect(
      warnings.some((w) => w.startsWith("Criterion “crit” has cards under it")),
    ).toBe(true);
    expect(warnings.some((w) => w.startsWith("3 sources back nothing"))).toBe(
      true,
    );
  });

  it("names cards in no stream, scoped to the cards a write touched", () => {
    const cards = [
      card("q1", "question", { streamId: "a" }),
      card("loose", "finding"),
      card("old", "finding"),
    ];
    const warnings = lintTopic(
      { cards, links: [], streams: [stream("a", 0)] },
      { cardIds: new Set(["loose"]) },
    );
    expect(warnings).toEqual([
      '1 card is in no stream (“loose”): set "stream" on the root card or add them under a card that has one.',
    ]);
  });

  it("stays quiet for a well-formed topic", () => {
    const cards = [
      card("q1", "question", { streamId: "a", gist: "Short." }),
      card("f1", "finding", { parentId: "q1", gist: "Answer." }),
      card("s1", "source", { parentId: "f1" }),
    ];
    expect(lintTopic({ cards, links: [], streams: [stream("a", 0)] })).toEqual(
      [],
    );
  });
});
