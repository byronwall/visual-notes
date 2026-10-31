import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  record: vi.fn(async () => {}),
  draftDistill: vi.fn(),
  fetchPage: vi.fn(),
  env: { TYPESAFE_API_KEY: "key" } as Record<string, string>,
}));

vi.mock("~/env/server", () => ({ serverEnv: mocks.env }));
vi.mock("~/server/lib/ai", () => ({ recordPaidCall: mocks.record }));
vi.mock("~/server/db", () => ({
  prisma: {
    doc: {
      findUnique: vi.fn(async () => ({
        title: "Saved",
        markdown: "https://example.com/page",
        html: "",
        content: null,
      })),
    },
  },
}));
vi.mock("./decide", () => ({
  createJevDecider: () => async () => ({
    model: "jev-test",
    answers: {},
    inputTokens: 120,
    latencyMs: 1,
  }),
  createOpenaiDecider: vi.fn(),
}));
vi.mock("./distill", () => ({ draftDistill: mocks.draftDistill }));
vi.mock("./link-check", async (original) => ({
  ...(await original<typeof import("./link-check")>()),
  fetchPage: mocks.fetchPage,
}));

import { deciderFor } from "./assess";
import { heuristicDecider } from "./heuristic";
import { expandLink } from "./link-expand";

beforeEach(() => vi.clearAllMocks());

describe("paid calls", () => {
  it("records a vendor decision with what started it", async () => {
    const decide = deciderFor("jev", "sweep:timer");
    await decide({ state: {}, questions: [], noteId: "n1", kind: "note" });
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: "sweep:timer:note",
        model: "jev-test",
        tokens: 120,
        noteId: "n1",
      }),
    );
  });

  it("does not wrap local rules, which cost nothing", () => {
    expect(deciderFor("heuristic", "sweep:timer")).toBe(heuristicDecider);
  });

  it("checks a link without any paid call until a summary is asked for", async () => {
    mocks.fetchPage.mockResolvedValue({
      httpStatus: 200,
      noHost: false,
      html: `<html><title>T</title><body><p>${"word ".repeat(100)}</p></body></html>`,
    });
    const page = await expandLink("n1", false);
    expect(page).toMatchObject({ readable: true, draft: null, worth: null });
    expect(mocks.draftDistill).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
