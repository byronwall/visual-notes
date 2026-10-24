import { describe, expect, it } from "vitest";
import type { ResearchCard, ResearchCardState, ResearchCardType } from "~/services/research/research.types";
import { groupChildren } from "~/services/research/research.graph";
import { bodyExcerpt, cardMatches, contentsSections, matchingIds, treeOrder } from "./contents";

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
  body: "",
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
    card("opt", "option", null, { parentId: "root", title: "Northwind quote", body: "Assumes a telematics discount" }),
    card("done", "task", "done", { parentId: "root" }),
    card("src", "source", null, { parentId: "opt" }),
    card("sum", "summary"),
    card("crit", "criterion", null, { parentId: "root" }),
  ];

  it("puts the open frontier first, types next, and finished work last, each card once", () => {
    const sections = contentsSections(cards, treeOrder(groupChildren(cards), cards));
    expect(sections.map((section) => [section.key, section.cards.map((c) => c.id)])).toEqual([
      ["open", ["root"]],
      ["criterion", ["crit"]],
      ["option", ["opt"]],
      ["source", ["src"]],
      ["summary", ["sum"]],
      ["closed", ["done"]],
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
    expect(bodyExcerpt(cards[1], "telematics")).toContain("telematics discount");
  });
});
