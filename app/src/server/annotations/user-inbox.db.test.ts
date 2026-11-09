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
const { closeRequest, replyToRequest } = await import("./requests");
const { dismissInboxItem, loadUserInbox } = await import("./user-inbox");

const body: NoteDoc = { type: "doc", content: [{ type: "paragraph", attrs: { id: "p1" }, content: [{ type: "text", text: "Hi" }] }] };

describe.skipIf(!enabled)("your inbox (database)", () => {
  client.current = enabled ? new PrismaClient({ datasources: { db: { url } } }) : null;
  const prisma = () => client.current!;
  const docIds: string[] = [];

  afterAll(async () => {
    if (!client.current) return;
    await prisma().doc.deleteMany({ where: { id: { in: docIds } } });
    await prisma().$disconnect();
  });

  const reasonOf = async (id: string) => {
    const inbox = await loadUserInbox();
    const item = inbox.needsYou.find((i) => "annotation" in i && i.annotation.id === id);
    if (item) return item.reason;
    return inbox.waiting.some((w) => w.annotation.id === id) ? "waiting" : "gone";
  };

  it("moves a request between waiting, agent reply, ready, and closed", async () => {
    const doc = await prisma().doc.create({ data: { title: `Inbox ${Date.now()}`, ...contentColumns(body) } });
    docIds.push(doc.id);
    const req = await createAnnotation({ docId: doc.id, typeId: await builtInTypeId(BUILT_IN.request), body: "Research this" });
    expect(await reasonOf(req.id)).toBe("waiting");

    await replyToRequest({ id: req.id, author: "ChatGPT", body: "Which brands?" });
    expect(await reasonOf(req.id)).toBe("agent-reply");
    await dismissInboxItem({ kind: "annotation", id: req.id });
    expect(await reasonOf(req.id)).toBe("waiting");

    await replyToRequest({ id: req.id, author: "ChatGPT", body: "Done.", ready: true });
    expect(await reasonOf(req.id)).toBe("ready");
    await closeRequest(req.id);
    expect(await reasonOf(req.id)).toBe("gone");
  });

  it("lists an agent's own annotation until you dismiss it", async () => {
    const doc = await prisma().doc.create({ data: { title: `Inbox note ${Date.now()}`, ...contentColumns(body) } });
    docIds.push(doc.id);
    const note = await createAnnotation({
      docId: doc.id,
      typeId: await builtInTypeId(BUILT_IN.fromAi),
      author: "Claude",
      body: "This conflicts with your March note.",
    });
    expect(await reasonOf(note.id)).toBe("agent-note");
    await dismissInboxItem({ kind: "annotation", id: note.id });
    expect(await reasonOf(note.id)).toBe("gone");
  });
});
