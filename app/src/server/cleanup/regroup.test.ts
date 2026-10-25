import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ prisma: {} }));

import { clusterPairs, readPlacement } from "./regroup";

const edge = (
  aId: string,
  bId: string,
  betterTogether: number,
  aCoversB = 0.2,
  bCoversA = 0.2,
) => ({
  aId,
  bId,
  betterTogether,
  aCoversB,
  bCoversA,
});

describe("clusterPairs", () => {
  it("joins chains of strong pairs and ignores weak ones", () => {
    const clusters = clusterPairs([
      edge("a", "b", 0.9),
      edge("b", "c", 0.7),
      edge("c", "d", 0.4),
      edge("x", "y", 0.65),
    ]);
    expect(clusters.map((c) => c.ids)).toEqual([
      ["a", "b", "c"],
      ["x", "y"],
    ]);
    expect(clusters[0].score).toBeCloseTo(0.8);
  });

  it("keeps the member that covers the others", () => {
    const [cluster] = clusterPairs([edge("a", "b", 0.8, 0.1, 0.9)]);
    expect(cluster.keeper).toBe("b");
  });

  it("caps cluster size", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const edges = ids.slice(1).map((id, i) => edge(ids[i], id, 0.9));
    expect(
      Math.max(...clusterPairs(edges).map((c) => c.ids.length)),
    ).toBeLessThanOrEqual(6);
  });
});

describe("readPlacement", () => {
  const targets = [
    {
      key: "path:woodwork",
      kind: "path" as const,
      value: "woodwork",
      label: "woodwork",
      description: "",
    },
  ];

  it("maps the chosen option to a target", () => {
    expect(
      readPlacement(
        {
          placement: {
            choice: "path:woodwork",
            probs: { "path:woodwork": 0.7 },
          },
        },
        targets,
      ),
    ).toEqual({ kind: "path", value: "woodwork", label: "woodwork", p: 0.7 });
  });

  it("returns null for other", () => {
    expect(
      readPlacement({ placement: { choice: "other", probs: {} } }, targets),
    ).toBeNull();
  });
});
