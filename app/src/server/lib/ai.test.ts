import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({
  prisma: {
    llmRequest: {
      create: vi.fn(async () => ({ id: "request" })),
      update: vi.fn(async () => ({})),
    },
  },
}));

import { callLLM } from "./ai";

const reply = {
  output: [{ content: [{ type: "output_text", text: "Draft" }] }],
};

afterEach(() => vi.unstubAllGlobals());

describe("Responses sampling parameters", () => {
  it.each(["gpt-5", "gpt-5-mini", "gpt-5-nano"])(
    "omits unsupported sampling settings for %s",
    async (model) => {
      const fetchMock = vi.fn<typeof fetch>(
        async () => new Response(JSON.stringify(reply)),
      );
      vi.stubGlobal("fetch", fetchMock);
      const result = await callLLM({
        model,
        user: "Summarize",
        temperature: 0.2,
        top_p: 0.9,
      });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body).not.toHaveProperty("temperature");
      expect(body).not.toHaveProperty("top_p");
      expect(result.output).toBe("Draft");
    },
  );

  it("preserves sampling for models that support it", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(reply)),
    );
    vi.stubGlobal("fetch", fetchMock);
    await callLLM({ model: "gpt-4o-mini", user: "Summarize", top_p: 0.9 });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.temperature).toBe(0.2);
    expect(body.top_p).toBe(0.9);
  });
});
