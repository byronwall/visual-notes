import { describe, expect, it } from "vitest";
import { frontier } from "./frontier";
import type { NodeStatus, PathwayGraph, PathwayNode } from "./types";

const n = (id: string, status: NodeStatus = "open"): PathwayNode => ({
  id,
  kind: id === "root" ? "root" : "step",
  title: `T ${id}`,
  note: "",
  by: "agent",
  status,
});
const hide = { done: false, dropped: false };

describe("frontier", () => {
  it("joins each parent of a done card to each of its children", () => {
    // root -> a -> b(done) -> c(done) -> d, and b also leads to e.
    const g: PathwayGraph = {
      nodes: [n("root"), n("a"), n("b", "done"), n("c", "done"), n("d"), n("e")],
      edges: [
        { from: "root", to: "a" },
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "d" },
        { from: "b", to: "e" },
      ],
    };
    const out = frontier(g, hide);
    expect(out.nodes.map((x) => x.id)).toEqual(["root", "a", "d", "e"]);
    expect(out.edges).toEqual(
      expect.arrayContaining([
        { from: "root", to: "a" },
        { from: "a", to: "d" },
        { from: "a", to: "e" },
      ]),
    );
    expect(out.edges).toHaveLength(3);
    expect(out.nodes.find((x) => x.id === "d")?.after).toEqual(["T b", "T c"]);
    expect(out.nodes.find((x) => x.id === "e")?.after).toEqual(["T b"]);
  });

  it("does not join across a dropped card", () => {
    const g: PathwayGraph = {
      nodes: [n("root"), n("a", "dropped"), n("b")],
      edges: [
        { from: "root", to: "a" },
        { from: "a", to: "b" },
      ],
    };
    expect(frontier(g, hide).edges).toEqual([]);
  });

  it("shows done cards as they are when asked", () => {
    const g: PathwayGraph = {
      nodes: [n("root"), n("a", "done")],
      edges: [{ from: "root", to: "a" }],
    };
    expect(frontier(g, { done: true, dropped: false })).toBe(g);
  });
});
