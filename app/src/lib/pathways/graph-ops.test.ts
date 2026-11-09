import { describe, expect, it } from "vitest";
import { applyOps } from "./graph-ops";
import { emptyGraph, type PathwayGraph } from "./types";

const ids = () => {
  let i = 0;
  return () => `id${++i}`;
};

const base = (): PathwayGraph => {
  const g = emptyGraph("Where should it live?");
  g.nodes.push(
    {
      id: "a",
      kind: "option",
      title: "Tasks page",
      note: "",
      by: "me",
      status: "open",
    },
    {
      id: "b",
      kind: "option",
      title: "Research board",
      note: "",
      by: "me",
      status: "open",
    },
    {
      id: "out",
      kind: "outcome",
      title: "A graph store",
      note: "",
      by: "me",
      status: "open",
    },
  );
  g.edges.push(
    { from: "root", to: "a" },
    { from: "root", to: "b" },
    { from: "a", to: "out" },
  );
  return g;
};

describe("applyOps", () => {
  it("adds nodes by ref and links a new path into an existing card", () => {
    const r = applyOps(
      base(),
      {
        nodes: [{ ref: "n1", kind: "step", title: "Add edges to cards" }],
        edges: [
          { from: "b", to: "n1" },
          { from: "n1", to: "out" },
        ],
      },
      "agent",
      ids(),
    );
    expect(r.added).toEqual(["id1"]);
    expect(
      r.graph.edges.filter((e) => e.to === "out").map((e) => e.from),
    ).toEqual(["a", "id1"]);
    expect(r.graph.nodes.find((n) => n.id === "id1")?.by).toBe("agent");
  });

  it("merges a duplicate: edges move to the survivor without duplicates or self-loops", () => {
    const g = base();
    g.nodes.push({
      id: "dup",
      kind: "outcome",
      title: "Graph storage",
      note: "",
      by: "agent",
      status: "open",
    });
    g.edges.push({ from: "a", to: "dup" }, { from: "b", to: "dup" });
    const r = applyOps(
      g,
      { merges: [{ keep: "out", drop: "dup", title: "A small graph store" }] },
      "agent",
    );
    expect(r.graph.nodes.some((n) => n.id === "dup")).toBe(false);
    expect(
      r.graph.edges
        .filter((e) => e.to === "out")
        .map((e) => e.from)
        .sort(),
    ).toEqual(["a", "b"]);
    expect(r.graph.nodes.find((n) => n.id === "out")?.title).toBe(
      "A small graph store",
    );
  });

  it("never drops, merges away, or removes the root, and reports unknown ids", () => {
    const r = applyOps(
      base(),
      {
        drops: ["root", "nope"],
        merges: [{ keep: "a", drop: "root" }],
        remove: ["root"],
      },
      "agent",
    );
    expect(r.graph.nodes.find((n) => n.id === "root")?.status).toBe("open");
    expect(r.skipped).toEqual(expect.arrayContaining(["root", "nope"]));
  });

  it("removing a card removes its edges, and null clears optional fields", () => {
    const g = base();
    g.nodes[1].feedback = { vote: "like", comment: "yes" };
    const r = applyOps(
      g,
      { remove: ["b"], update: [{ id: "a", feedback: null, weight: "key" }] },
      "me",
    );
    expect(r.graph.edges.some((e) => e.to === "b" || e.from === "b")).toBe(
      false,
    );
    expect(r.graph.nodes.find((n) => n.id === "a")).toMatchObject({
      weight: "key",
    });
    expect(r.graph.nodes.find((n) => n.id === "a")?.feedback).toBeUndefined();
  });
});
