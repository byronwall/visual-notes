import { describe, expect, it } from "vitest";
import type {
  ResearchCard,
  ResearchCardState,
  ResearchCardType,
  ResearchSummaryGroup,
} from "~/services/research/research.types";
import { foldView, levelForScale } from "./fold";
import { layoutTree } from "./tree-layout";

let order = 0;
const card = (
  id: string,
  parentId: string | null = null,
  type: ResearchCardType = "finding",
  state: ResearchCardState | null = null,
): ResearchCard => ({
  id,
  type,
  title: id,
  body: "",
  state,
  url: null,
  snippet: null,
  imageUrl: null,
  parentId,
  sortOrder: order++,
  nudgeX: null,
  nudgeY: null,
  batchId: null,
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
});
const group = (
  id: string,
  summaryCardId: string,
  memberIds: string[],
  status: ResearchSummaryGroup["status"] = "accepted",
): ResearchSummaryGroup => ({ id, summaryCardId, memberIds, status });

const visibleIds = (view: ReturnType<typeof foldView>) => view.nodes.map((node) => node.id).sort();

// root ─ a ─ a1 (open question)
//      │   └ a2
//      └ b ─ b1
const base = () => [
  card("root", null, "question", "open"),
  card("a", "root"),
  card("a1", "a", "question", "open"),
  card("a2", "a"),
  card("b", "root"),
  card("b1", "b"),
  card("sA", null, "summary"),
  card("sAll", null, "summary"),
];

describe("foldView", () => {
  it("shows every plain card at level 0 and draws groups as hulls", () => {
    const view = foldView({ cards: base(), groups: [group("gA", "sA", ["a", "a1", "a2"])], level: 0 });
    expect(visibleIds(view)).toEqual(["a", "a1", "a2", "b", "b1", "root"]);
    expect(view.hulls.map((hull) => [hull.groupId, hull.memberNodeIds.sort()])).toEqual([
      ["gA", ["a", "a1", "a2"]],
    ]);
    expect(view.maxLevel).toBe(1);
  });

  it("folds an accepted group into its summary while open cards pierce the fold", () => {
    const view = foldView({ cards: base(), groups: [group("gA", "sA", ["a", "a1", "a2"])], level: 1 });
    expect(visibleIds(view)).toEqual(["a1", "b", "b1", "root", "sA"]);
    expect(view.parent.get("sA")).toBe("root");
    expect(view.parent.get("a1")).toBe("sA");
    const summary = view.nodes.find((node) => node.id === "sA")!;
    expect(summary).toMatchObject({ kind: "summary", coveredCount: 3, openInside: 1 });
    expect(view.rep.get("a2")).toBe("sA");
    expect(view.hulls).toEqual([]);
  });

  it("folds the came-from descendants of covered cards too", () => {
    // gB covers only b; b1 hangs under b and goes with it.
    const cards = [...base(), card("sB", null, "summary")];
    const view = foldView({ cards, groups: [group("gB", "sB", ["b"])], level: 1 });
    expect(visibleIds(view)).toEqual(["a", "a1", "a2", "root", "sB"]);
    expect(view.nodes.find((node) => node.id === "sB")).toMatchObject({ coveredCount: 2 });
  });

  it("stops folding descendants at other summaries and below open cards", () => {
    // root → x → [y (covered by gY), q (open) → z]
    const cards = [
      card("x"),
      card("y", "x"),
      card("q", "x", "question", "open"),
      card("z", "q"),
      card("sX", null, "summary"),
      card("sY", null, "summary"),
    ];
    const view = foldView({
      cards,
      groups: [group("gX", "sX", ["x"]), group("gY", "sY", ["y"])],
      level: 1,
    });
    expect(visibleIds(view)).toEqual(["q", "sX", "sY", "z"]);
    expect(view.nodes.find((node) => node.id === "sX")).toMatchObject({ coveredCount: 2, openInside: 1 });
    expect(view.parent.get("z")).toBe("q");
    expect(view.parent.get("sY")).toBe("sX");
  });

  it("never folds a draft group", () => {
    const view = foldView({
      cards: base(),
      groups: [group("gA", "sA", ["a", "a1", "a2"], "draft")],
      level: 3,
    });
    expect(visibleIds(view)).toEqual(["a", "a1", "a2", "b", "b1", "root"]);
    expect(view.hulls[0]).toMatchObject({ groupId: "gA", status: "draft" });
  });

  it("folds nested summaries one layer per level", () => {
    const groups = [group("gA", "sA", ["a", "a1", "a2"]), group("gAll", "sAll", ["sA", "b", "b1"])];
    const level1 = foldView({ cards: base(), groups, level: 1 });
    expect(level1.maxLevel).toBe(2);
    expect(visibleIds(level1)).toEqual(["a1", "b", "b1", "root", "sA"]);
    expect(level1.hulls.map((hull) => [hull.groupId, hull.memberNodeIds.sort()])).toEqual([
      ["gAll", ["b", "b1", "sA"]],
    ]);

    const level2 = foldView({ cards: base(), groups, level: 2 });
    expect(visibleIds(level2)).toEqual(["a1", "root", "sAll"]);
    expect(level2.rep.get("sA")).toBe("sAll");
    expect(level2.rep.get("a2")).toBe("sAll");
    expect(level2.parent.get("a1")).toBe("sAll");
    expect(level2.nodes.find((node) => node.id === "sAll")).toMatchObject({ coveredCount: 5, openInside: 1 });
  });

  it("links extra came-from parents of a cross-branch summary", () => {
    const cards = [card("p"), card("x", "p"), card("q"), card("y", "q"), card("s", null, "summary")];
    const view = foldView({ cards, groups: [group("g", "s", ["x", "y"])], level: 1 });
    expect(view.parent.get("s")).toBe("p");
    expect(view.edges).toEqual([{ from: "q", to: "s", kind: "also" }]);
  });

  it("breaks the cycle when a group skips an open generation", () => {
    // c is open, so it pierces the fold and sits between p and g.
    const cards = [card("p"), card("c", "p", "question", "open"), card("g", "c"), card("s", null, "summary")];
    const view = foldView({ cards, groups: [group("grp", "s", ["p", "g"])], level: 1 });
    expect(view.parent.get("c")).toBe("s");
    expect(view.parent.get("s")).toBeNull();
    const layout = layoutTree(view);
    expect(layout.rects.size).toBe(view.nodes.length);
  });

  it("fades done and dropped branches but keeps open descendants bright", () => {
    const cards = [card("t", null, "task", "done"), card("f", "t"), card("q", "f", "question", "open")];
    const view = foldView({ cards, groups: [], level: 0 });
    const faded = Object.fromEntries(view.nodes.map((node) => [node.id, node.faded]));
    expect(faded).toEqual({ t: true, f: true, q: false });
  });

  it("maps relates-to links through folds and drops self-links", () => {
    const view = foldView({
      cards: base(),
      groups: [group("gA", "sA", ["a", "a1", "a2"])],
      links: [
        { id: "l1", fromId: "a2", toId: "b1", kind: "relates_to" },
        { id: "l2", fromId: "a", toId: "a2", kind: "relates_to" },
        { id: "l3", fromId: "b1", toId: "a", kind: "relates_to" },
      ],
      level: 1,
    });
    expect(view.edges).toEqual([{ from: "sA", to: "b1", kind: "relates" }]);
  });
});

describe("levelForScale", () => {
  it("folds one more layer below each threshold, capped at the deepest layer", () => {
    expect(levelForScale(1, 3)).toBe(0);
    expect(levelForScale(0.6, 3)).toBe(1);
    expect(levelForScale(0.35, 3)).toBe(2);
    expect(levelForScale(0.2, 1)).toBe(1);
  });
});

describe("layoutTree", () => {
  it("lays out left to right without overlaps and centers parents on their children", () => {
    const view = foldView({ cards: base(), groups: [], level: 0 });
    const { rects } = layoutTree(view);
    const all = [...rects.entries()];
    for (const [idA, a] of all) {
      for (const [idB, b] of all) {
        if (idA >= idB) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${idA} overlaps ${idB}`).toBe(false);
      }
    }
    expect(rects.get("a")!.x).toBeGreaterThan(rects.get("root")!.x);
    const a = rects.get("a")!;
    const a1 = rects.get("a1")!;
    const a2 = rects.get("a2")!;
    expect(a.y + a.h / 2).toBeCloseTo((a1.y + a2.y + a2.h) / 2, 0);
  });

  it("applies saved nudges as offsets after layout", () => {
    const view = foldView({ cards: base(), groups: [], level: 0 });
    const plain = layoutTree(view).rects.get("b1")!;
    const nudged = layoutTree(view, new Map([["b1", { x: 30, y: -10 }]])).rects.get("b1")!;
    expect([nudged.x - plain.x, nudged.y - plain.y]).toEqual([30, -10]);
  });
});
