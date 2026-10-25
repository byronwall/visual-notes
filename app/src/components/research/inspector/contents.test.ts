import { describe, expect, it } from "vitest";
import type {
  ResearchCard,
  ResearchCardState,
  ResearchCardType,
} from "~/services/research/research.types";
import { buildBoard } from "../board/board-model";
import {
  bodyExcerpt,
  cardMatches,
  contentsSections,
  matchingIds,
} from "./contents";

let order = 0;
const card = (
  id: string,
  type: ResearchCardType,
  state: ResearchCardState | null = null,
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
  state,
  url: null,
  snippet: null,
  imageUrl: null,
  parentId: null,
  sortOrder: order++,
  nudgeX: null,
  nudgeY: null,
  batchId: null,
  createdAt: "2026-10-23T00:00:00.000Z",
  updatedAt: "2026-10-23T00:00:00.000Z",
  ...extra,
});

describe("contents", () => {
  const cards = [
    card("root", "question", "open"),
    card("opt", "option", null, {
      parentId: "root",
      title: "Northwind quote",
      body: "Assumes a telematics discount",
    }),
    card("done", "task", "done", { parentId: "root" }),
    card("src", "source", null, { parentId: "opt" }),
    card("sum", "summary"),
    card("crit", "criterion", null, { parentId: "root" }),
  ];

  it("mirrors the board: criteria, then each stream in board order with cited sources", () => {
    const board = buildBoard({ cards, links: [], streams: [] });
    const sections = contentsSections(board, cards);
    expect(
      sections.map((section) => [
        section.label,
        section.cards.map((c) => c.id),
      ]),
    ).toEqual([
      ["root", ["crit", "opt", "root", "done", "src"]],
      ["Unsorted", ["sum"]],
    ]);
  });

  it("matches every token across title and body", () => {
    expect(cardMatches(cards[1], "northwind telematics")).toBe(true);
    expect(cardMatches(cards[1], "northwind keystone")).toBe(false);
    expect(matchingIds(cards, "  ")).toBeNull();
    expect([...matchingIds(cards, "telematics")!]).toEqual(["opt"]);
  });

  it("explains a body-only match with an excerpt", () => {
    expect(bodyExcerpt(cards[1], "northwind")).toBeNull();
    expect(bodyExcerpt(cards[1], "telematics")).toContain(
      "telematics discount",
    );
  });
});
