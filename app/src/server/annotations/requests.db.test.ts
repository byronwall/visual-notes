import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { testDatabaseEnabled as enabled, testDatabaseUrl as url } from "~/test/database";
import { contentColumns } from "~/server/notes/note-store";
import type { NoteDoc } from "~/lib/note-content/types";

const { client } = vi.hoisted(() => ({ client: { current: null as PrismaClient | null } }));
vi.mock("~/server/db", () => ({
  get prisma() {
    return client.current;
  },
}));
vi.mock("~/server/events/action-events", () => ({ logActionEvent: vi.fn() }));
vi.mock("~/server/note-events", () => ({ publishAppChange: vi.fn() }));

const { createAnnotation } = await import("./annotations");
const { BUILT_IN, builtInTypeId } = await import("./annotation-types");
const { claimRequest, closeRequest, replyToRequest, CLAIM_TTL_MS } = await import("./requests");
const { readAgentInbox } = await import("./agent-inbox");

const body: NoteDoc = {
  type: "doc",
  content: [{ type: "paragraph", attrs: { id: "p1" }, content: [{ type: "text", text: "Heat pumps lose capacity." }] }],
};
const links = { note: (id: string) => `/docs/${id}`, tasks: (id: string) => `/tasks?list=${id}`, research: (s: string) => `/research/${s}` };

describe.skipIf(!enabled)("requests (database)", () => {
  client.current = enabled ? new PrismaClient({ datasources: { db: { url } } }) : null;
  const prisma = () => client.current!;
  const docIds: string[] = [];

  const request = async (ask: string) => {
    const doc = await prisma().doc.create({ data: { title: `Request ${Date.now()}`, ...contentColumns(body) } });
    docIds.push(doc.id);
    return createAnnotation({ docId: doc.id, typeId: await builtInTypeId(BUILT_IN.request), body: ask });
  };

  afterAll(async () => {
    if (!client.current) return;
    await prisma().doc.deleteMany({ where: { id: { in: docIds } } });
    await prisma().$disconnect();
  });

  it("lets exactly one of two racing agents claim a request", async () => {
    const req = await request("Find newer sources");
    expect(req.status).toBe("open");
    const results = await Promise.allSettled([
      claimRequest({ id: req.id, agent: "ChatGPT" }),
      claimRequest({ id: req.id, agent: "Claude" }),
    ]);
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(won).toHaveLength(1);
    expect(String(lost[0].reason)).toMatch(/Already claimed by/);
  });

  it("lets another agent take a claim that lapsed", async () => {
    const req = await request("Follow up");
    await claimRequest({ id: req.id, agent: "ChatGPT" });
    await prisma().annotation.update({
      where: { id: req.id },
      data: { claimedAt: new Date(Date.now() - CLAIM_TTL_MS - 1000) },
    });
    const taken = await claimRequest({ id: req.id, agent: "Claude" });
    expect(taken.claimedBy).toBe("Claude");
  });

  it("runs ready, reopen on your reply, close, and refuses agent replies once closed", async () => {
    const req = await request("Expand this");
    const ready = await replyToRequest({ id: req.id, author: "ChatGPT", body: "Added two sources.", ready: true });
    expect(ready.status).toBe("ready");
    const reopened = await replyToRequest({ id: req.id, author: "you", body: "Also check 2026 models." });
    expect(reopened.status).toBe("open");
    expect(reopened.claimedBy).toBeNull();
    expect(reopened.messages.map((m) => m.author)).toEqual(["ChatGPT", "you"]);
    await closeRequest(req.id);
    await expect(replyToRequest({ id: req.id, author: "ChatGPT", body: "More" })).rejects.toThrow(/closed/);
  });

  it("lists open requests with their thread and only what changed since a poll", async () => {
    const req = await request("Is this still true?");
    const first = await readAgentInbox({ links });
    const listed = first.requests.find((r) => r.id === req.id);
    expect(listed).toMatchObject({ ask: "Is this still true?", on: "note", claimable: true, status: "open" });
    const later = await readAgentInbox({ since: new Date(first.pollSince), links });
    expect(later.requests.find((r) => r.id === req.id)).toBeUndefined();
    await replyToRequest({ id: req.id, author: "you", body: "Any update?" });
    const after = await readAgentInbox({ since: new Date(first.pollSince), links });
    expect(after.requests.find((r) => r.id === req.id)?.thread).toEqual([
      expect.objectContaining({ from: "you", text: "Any update?" }),
    ]);
  });
});
