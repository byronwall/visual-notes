import { describe, expect, it } from "vitest";
import { fuseRankings } from "./rank-fusion";

describe("fuseRankings", () => {
  it("lifts notes found by both keyword and meaning", () => {
    const fused = fuseRankings(["a", "b", "c"], ["c", "d"], 10);
    expect(fused[0]).toEqual({ id: "c", match: "both" });
    // Equal ranks tie; keyword hits come first.
    expect(fused.map((hit) => hit.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("keeps keyword-only order when semantic search is unavailable", () => {
    expect(fuseRankings(["a", "b"], [], 1)).toEqual([
      { id: "a", match: "keyword" },
    ]);
  });
});
