import { describe, expect, it } from "vitest";
import { buildBoard } from "../board/board-model";
import type { ResearchCard } from "~/services/research/research.types";
import { layoutMap } from "./map-layout";
import { buildMapTree } from "./map-model";

const card = (id: string, streamId: string, type = "finding"): ResearchCard =>
  ({
    id,
    type,
    title: id,
    gist: "",
    body: "",
    state: null,
    parentId: null,
    streamId,
    sortOrder: 0,
    createdAt: "2026-01-01",
  }) as unknown as ResearchCard;

const stream = (id: string, sortOrder: number) =>
  ({
    id,
    key: id,
    title: id,
    goal: "",
    answer: "",
    sortOrder,
    createdAt: "2026-01-01",
  }) as never;

const topic = () => {
  const streams = ["a", "b", "c", "d"].map(stream);
  const cards = streams.flatMap((_, index) =>
    Array.from({ length: 9 }, (__, n) =>
      card(
        `c${index}-${n}`,
        ["a", "b", "c", "d"][index],
        n % 2 ? "finding" : "task",
      ),
    ),
  );
  const board = buildBoard({ cards, links: [], streams });
  return buildMapTree(board, cards, "Topic", "");
};

const overlaps = (a: DOMRectLike, b: DOMRectLike) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
type DOMRectLike = { x: number; y: number; w: number; h: number };

describe("layoutMap", () => {
  it("keeps every node apart with all branches open", () => {
    const tree = topic();
    const { boxes } = layoutMap(tree, new Set(tree.byId.keys()));
    expect(boxes).toHaveLength(tree.byId.size);
    for (const [index, box] of boxes.entries())
      for (const other of boxes.slice(index + 1))
        expect(overlaps(box, other), `${box.id} / ${other.id}`).toBe(false);
  });

  it("opening a branch leaves the root and the other side in place", () => {
    const tree = topic();
    const before = layoutMap(tree, new Set());
    const opened = tree.root.children[0];
    const after = layoutMap(tree, new Set([opened.id]));
    expect(after.byId.get("root")).toEqual(before.byId.get("root"));
    expect(after.byId.get(opened.id)?.y).toBe(before.byId.get(opened.id)?.y);
    for (const stream of tree.root.children.filter(
      (node) => node.side === "left",
    ))
      expect(after.byId.get(stream.id)).toEqual(before.byId.get(stream.id));
  });
});
