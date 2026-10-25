import { describe, expect, it, vi } from "vitest";

vi.mock("~/env/server", () => ({ serverEnv: {} }));
vi.mock("~/server/lib/ai", () => ({ callLLM: vi.fn() }));

import { localEvergreen, localExtract, parseDraftJson } from "./distill";

describe("parseDraftJson", () => {
  it("reads bullets and code out of a fenced reply", () => {
    expect(
      parseDraftJson(
        '```json\n{"title":"T","bullets":["a","b"],"code":"x"}\n```',
      ),
    ).toEqual({ title: "T", bullets: ["a", "b"], code: "x" });
  });

  it("rejects replies without bullets", () => {
    expect(parseDraftJson('{"title":"T","bullets":[]}')).toBeNull();
    expect(parseDraftJson("no json")).toBeNull();
  });
});

describe("localExtract", () => {
  it("keeps answer sentences, drops questions and filler", () => {
    const draft = localExtract(
      "CSV",
      "**You:** What should I use to parse CSV files in the browser?\n\n**ChatGPT:** Great question! PapaParse is well maintained and works in the browser and Node.js. It supports streaming for large files.\n\nLink back: https://chatgpt.com/c/1",
    );
    expect(draft.model).toBe("local-extract");
    expect(draft.markdown).toBe(
      "- PapaParse is well maintained and works in the browser and Node.js.\n- It supports streaming for large files.",
    );
  });
});

describe("localEvergreen", () => {
  it("keeps only sections whose heading reads as reusable", () => {
    const draft = localEvergreen(
      "Camping Trip",
      "Trip on Sep 13.\n\n## Carpool\n\n- Leave at 4pm\n\n## Packing list\n\n- Tent\n- Headlamp\n\n## Next time\n\n- Bring a tarp",
    );
    expect(draft.title).toBe("Camping Trip: for next time");
    expect(draft.markdown).toBe("- Tent\n- Headlamp\n- Bring a tarp");
  });
});
