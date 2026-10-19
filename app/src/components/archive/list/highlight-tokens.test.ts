import { describe, expect, it } from "vitest";
import { splitByTokens } from "./highlight-tokens";

describe("splitByTokens", () => {
  it("returns the whole text when the query is empty", () => {
    expect(splitByTokens("Camping gear", "  ")).toEqual([{ text: "Camping gear", match: false }]);
  });

  it("marks every case-insensitive occurrence of each token", () => {
    expect(splitByTokens("Camp stove for camping", "CAMP stove")).toEqual([
      { text: "Camp", match: true },
      { text: " ", match: false },
      { text: "stove", match: true },
      { text: " for ", match: false },
      { text: "camp", match: true },
      { text: "ing", match: false },
    ]);
  });

  it("treats regex characters in the query literally", () => {
    expect(splitByTokens("a.b (c)", "(c)")).toEqual([
      { text: "a.b ", match: false },
      { text: "(c)", match: true },
    ]);
  });
});
