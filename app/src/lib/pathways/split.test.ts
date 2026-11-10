import { describe, expect, it } from "vitest";
import { splitGraph } from "./split";
import type { PathwayGraph, PathwayNode } from "./types";

const n = (id: string): PathwayNode => ({
  id,
  kind: id === "root" ? "root" : "step",
  title: `T ${id}`,
  note: "",
  by: "agent",
  status: "open",
});

describe("splitGraph", () => {
  it("makes the card the question and keeps only what follows from it", () => {
    const g: PathwayGraph = {
      nodes: ["root", "a", "b", "a1", "a2", "b1"].map(n),
      edges: [
        { from: "root", to: "a" },
        { from: "root", to: "b" },
        { from: "a", to: "a1" },
        { from: "a1", to: "a2" },
        { from: "b", to: "b1" },
        // b1 also leads into a2: a2 comes along, b1 stays behind.
        { from: "b1", to: "a2" },
      ],
    };
    const out = splitGraph(g, "a");
    expect(out.nodes.map((x) => x.id)).toEqual(["root", "a1", "a2"]);
    expect(out.nodes[0]).toMatchObject({ kind: "root", title: "T a" });
    expect(out.edges).toEqual([
      { from: "root", to: "a1" },
      { from: "a1", to: "a2" },
    ]);
  });
});
