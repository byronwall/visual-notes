import { describe, expect, it } from "vitest";
import type {
  ResearchCard,
  ResearchCardType,
  ResearchLink,
  ResearchStream,
} from "~/services/research/research.types";
import { buildBoard, relatedIds, type BoardModel } from "./board-model";

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
  title: id.toUpperCase(),
  goal: "",
  answer: "",
  sortOrder,
  batchId: null,
  createdAt: "2026-10-24T00:00:00.000Z",
  updatedAt: "2026-10-24T00:00:00.000Z",
});
const link = (fromId: string, toId: string, kind: string): ResearchLink => ({
  id: `${fromId}>${toId}`,
  fromId,
  toId,
  kind,
});

const shape = (model: BoardModel) =>
  Object.fromEntries(
    model.columns.map((column) => [
      column.column.id,
      Object.fromEntries(
        column.blocks.map((block) => [
          block.key,
          block.nodes.map((node) =>
            node.children.length
              ? { [node.card.id]: node.children.map((c) => c.card.id) }
              : node.card.id,
          ),
        ]),
      ),
    ]),
  );

const insuranceLike = () => {
  const cards = [
    card("q", "question", { streamId: "pick" }),
    card("o1", "option", { streamId: "pick" }),
    card("o2", "option", { streamId: "pick" }),
    card("qa", "question", { streamId: "pick" }),
    card("fa", "finding", { parentId: "qa" }),
    card("sa", "source", { parentId: "fa" }),
    card("t", "task", { streamId: "pick" }),
    card("r", "finding", { parentId: "t" }),
    card("h", "question", { streamId: "home" }),
    card("crit", "criterion"),
    card("loose", "finding"),
  ];
  const links = [link("o1", "qa", "blocks"), link("o2", "h", "blocks")];
  return { cards, links, streams: [stream("pick", 0), stream("home", 1)] };
};

describe("buildBoard", () => {
  it("puts each card in its stream's fixed block, nesting answers and results, citing sources", () => {
    const model = buildBoard(insuranceLike());
    expect(shape(model)).toEqual({
      pick: {
        options: ["o1", "o2"],
        questions: ["q", { qa: ["fa"] }],
        tasks: [{ t: ["r"] }],
      },
      home: { questions: ["h"] },
      unsorted: { notes: ["loose"] },
    });
    expect(model.topicCriteria.map((c) => c.id)).toEqual(["crit"]);
    expect(model.relations.citations.get("fa")?.map((c) => c.id)).toEqual([
      "sa",
    ]);
    expect(model.columns[0].order).toEqual([
      "o1",
      "o2",
      "q",
      "qa",
      "fa",
      "t",
      "r",
    ]);
    expect(model.columnOf.get("sa")).toBe("pick");
  });

  it("keeps earlier positions when a card is added to another stream or later in the same one", () => {
    const before = buildBoard(insuranceLike());
    const next = insuranceLike();
    next.cards.push(
      card("h2", "question", { streamId: "home" }),
      card("t2", "task", { streamId: "pick" }),
    );
    const after = buildBoard(next);
    const pickBefore = before.columns[0].order;
    // A card added at the end of a block moves nothing above it.
    expect(after.columns[0].order).toEqual([...pickBefore, "t2"]);
    expect(after.columns[1].order).toEqual(["h", "h2"]);
  });

  it("does not nest across streams: an answer in another stream stays its own card", () => {
    const graph = insuranceLike();
    graph.cards.push(
      card("far", "finding", { parentId: "h", streamId: "pick" }),
    );
    const model = buildBoard(graph);
    expect(shape(model).pick.notes).toEqual(["far"]);
    expect(shape(model).home).toEqual({ questions: ["h"] });
  });

  it("hides the Unsorted column when nothing is unsorted", () => {
    const graph = insuranceLike();
    graph.cards = graph.cards.filter((c) => c.id !== "loose");
    expect(buildBoard(graph).columns.map((c) => c.column.id)).toEqual([
      "pick",
      "home",
    ]);
  });

  it("relates a card to its answers, holders, blockers, and the options it blocks", () => {
    const model = buildBoard(insuranceLike());
    const byId = new Map(insuranceLike().cards.map((c) => [c.id, c]));
    expect([...relatedIds(model, byId.get("qa")!)].sort()).toEqual([
      "fa",
      "o1",
    ]);
    expect([...relatedIds(model, byId.get("fa")!)].sort()).toEqual([
      "qa",
      "sa",
    ]);
  });
});
