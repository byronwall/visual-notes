import { describe, expect, it, vi } from "vitest";

vi.mock("~/env/server", () => ({ serverEnv: {} }));
vi.mock("~/server/lib/ai", () => ({ callLLM: vi.fn() }));

import { localExtract, parseDraftJson } from "./distill";

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
