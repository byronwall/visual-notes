import { describe, expect, it } from "vitest";
import { resolveOptions } from "../../scripts/browser/kit.mjs";
import { layoutProblems } from "../../scripts/browser/layout.mjs";

describe("browser kit options", () => {
  it("prefers explicit options, then flags, then the environment", () => {
    const env = { PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3200" };
    expect(
      resolveOptions({ base: "http://a:1/" }, ["--base", "http://b:2"], env)
        .base,
    ).toBe("http://a:1");
    expect(resolveOptions({}, ["--base", "http://b:2"], env).base).toBe(
      "http://b:2",
    );
    expect(resolveOptions({}, [], env).base).toBe("http://127.0.0.1:3200");
    expect(resolveOptions({}, [], { PORT: "3999" }).base).toBe(
      "http://127.0.0.1:3999",
    );
  });

  it("passes positional arguments through to the script", () => {
    const { args, out } = resolveOptions(
      {},
      ["--base", "http://b:2", "/tasks", "abc"],
      {},
    );
    expect(args).toEqual(["/tasks", "abc"]);
    expect(out).toMatch(/^tmp\/browser\//);
  });
});

describe("layoutProblems", () => {
  it("is empty for a clean report and labels each problem kind", () => {
    const clean = {
      horizontalOverflow: false,
      offscreen: [],
      clipped: [],
      overlaps: [],
      smallTargets: [],
    };
    expect(layoutProblems(clean)).toEqual([]);
    expect(
      layoutProblems({
        ...clean,
        horizontalOverflow: true,
        overlaps: ["a x b"],
        clipped: ["p"],
      }),
    ).toEqual(["h-overflow", "1 clipped", "1 overlaps"]);
  });
});
